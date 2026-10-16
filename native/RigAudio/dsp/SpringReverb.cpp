#include "SpringReverb.h"
#include <cmath>

namespace timsamp
{

namespace
{
// Uneven metallic modes — spring tank, not hall
constexpr float kDelayMs[5] = { 27.1f, 33.8f, 41.6f, 49.4f, 58.7f };
constexpr float kAllpassMs[4] = { 3.7f, 5.9f, 8.4f, 11.2f };
} // namespace

void SpringReverbProcessor::prepare(const juce::dsp::ProcessSpec& spec)
{
    sampleRate = (float) spec.sampleRate;
    modInc = (2.0f * juce::MathConstants<float>::pi * 1.7f) / sampleRate;

    wetGain.reset(spec.sampleRate, 0.04);
    decay.reset(spec.sampleRate, 0.05);
    toneDamp.reset(spec.sampleRate, 0.05);
    driveAmt.reset(spec.sampleRate, 0.05);
    diffusion.reset(spec.sampleRate, 0.05);
    flutter.reset(spec.sampleRate, 0.05);

    wetHp.prepare(spec);
    wetLp.prepare(spec);
    wetHp.setType(juce::dsp::StateVariableTPTFilterType::highpass);
    wetLp.setType(juce::dsp::StateVariableTPTFilterType::lowpass);
    wetHp.setCutoffFrequency(120.0f);
    wetLp.setCutoffFrequency(6000.0f);
    wetHp.setResonance(0.707f);
    wetLp.setResonance(0.707f);

    dryScratch.setSize((int) spec.numChannels, (int) spec.maximumBlockSize);
    resizeBuffers();
    reset();
    prepared = true;
}

void SpringReverbProcessor::resizeBuffers()
{
    for (int i = 0; i < kLines; ++i)
    {
        const int len = juce::jmax(16, (int) std::round(kDelayMs[i] * 0.001f * sampleRate) + 128);
        lines[(size_t) i].buf.assign((size_t) len, 0.0f);
        lines[(size_t) i].length = len;
        lines[(size_t) i].write = 0;
        lines[(size_t) i].lp = 0.0f;
    }

    for (int i = 0; i < kAllpasses; ++i)
    {
        const int len = juce::jmax(8, (int) std::round(kAllpassMs[i] * 0.001f * sampleRate));
        allpasses[(size_t) i].buf.assign((size_t) len, 0.0f);
        allpasses[(size_t) i].length = len;
        allpasses[(size_t) i].write = 0;
    }
}

void SpringReverbProcessor::reset() noexcept
{
    for (auto& line : lines)
    {
        std::fill(line.buf.begin(), line.buf.end(), 0.0f);
        line.write = 0;
        line.lp = 0.0f;
    }
    for (auto& ap : allpasses)
    {
        std::fill(ap.buf.begin(), ap.buf.end(), 0.0f);
        ap.write = 0;
    }
    hpState = 0.0f;
    modPhase = 0.0f;
    wetHp.reset();
    wetLp.reset();
    wetGain.setCurrentAndTargetValue(wetGain.getTargetValue());
    decay.setCurrentAndTargetValue(decay.getTargetValue());
    toneDamp.setCurrentAndTargetValue(toneDamp.getTargetValue());
    driveAmt.setCurrentAndTargetValue(driveAmt.getTargetValue());
    diffusion.setCurrentAndTargetValue(diffusion.getTargetValue());
    flutter.setCurrentAndTargetValue(flutter.getTargetValue());
}

void SpringReverbProcessor::updateTargetsFromAmount(float amount) noexcept
{
    const float a = juce::jlimit(0.0f, 10.0f, amount);
    const float t = a / 10.0f;
    // Ease-in so low settings stay subtle
    const float shaped = t * t * (3.0f - 2.0f * t); // smoothstep
    const float accent = t * t;

    wetGain.setTargetValue(shaped * 0.42f);
    decay.setTargetValue(0.38f + shaped * 0.42f + accent * 0.08f);
    toneDamp.setTargetValue(0.62f - shaped * 0.28f); // brighter as knob rises
    driveAmt.setTargetValue(accent * 0.55f);
    diffusion.setTargetValue(0.42f + shaped * 0.28f);
    flutter.setTargetValue(0.85f + shaped * 0.55f);
}

void SpringReverbProcessor::setAmount(float amount0to10) noexcept
{
    updateTargetsFromAmount(amount0to10);
}

float SpringReverbProcessor::softDrive(float x, float drive) const noexcept
{
    if (drive < 1.0e-4f)
        return x;
    const float gain = 1.0f + drive * 1.8f;
    return std::tanh(x * gain) * (1.0f / std::tanh(gain));
}

float SpringReverbProcessor::readInterpolated(const std::vector<float>& buf, int write, int length, float delaySamples) const noexcept
{
    float readPos = (float) write - delaySamples;
    while (readPos < 0.0f)
        readPos += (float) length;

    const int i0 = ((int) readPos % length + length) % length;
    const int i1 = (i0 + 1) % length;
    const float frac = readPos - std::floor(readPos);
    return buf[(size_t) i0] * (1.0f - frac) + buf[(size_t) i1] * frac;
}

float SpringReverbProcessor::processAllpass(Allpass& ap, float x, float g) noexcept
{
    const float delayed = ap.buf[(size_t) ((ap.write + ap.length - 1) % ap.length)];
    const float y = -g * x + delayed;
    ap.buf[(size_t) ap.write] = x + g * y;
    ap.write = (ap.write + 1) % ap.length;
    return y;
}

float SpringReverbProcessor::processTank(float x) noexcept
{
    constexpr float hp = 0.018f;
    hpState += hp * (x - hpState);
    float y = x - hpState;

    modPhase += modInc;
    if (modPhase > juce::MathConstants<float>::twoPi)
        modPhase -= juce::MathConstants<float>::twoPi;
    const float mod = std::sin(modPhase) * flutter.getNextValue();

    const float decayNow = decay.getNextValue();
    const float dampNow = toneDamp.getNextValue();
    const float diffNow = diffusion.getNextValue();
    const float lpCoeff = 0.08f + (1.0f - dampNow) * 0.58f;

    float tank = 0.0f;
    for (int i = 0; i < kLines; ++i)
    {
        auto& line = lines[(size_t) i];
        const float baseDelay = kDelayMs[i] * 0.001f * sampleRate;
        const float delaySamp = baseDelay + mod * (1.8f + 0.9f * (float) i);
        const float delayed = readInterpolated(line.buf, line.write, line.length, delaySamp);

        line.lp += lpCoeff * (delayed - line.lp);
        float fb = line.lp * decayNow * (0.72f + 0.04f * (float) i);
        fb = std::tanh(fb * 1.35f);

        line.buf[(size_t) line.write] = y * 0.48f + fb;
        line.write = (line.write + 1) % line.length;
        tank += delayed;
    }
    tank *= 0.22f;

    const float g0 = 0.40f + diffNow * 0.25f;
    const float g1 = 0.35f + diffNow * 0.22f;
    const float g2 = 0.30f + diffNow * 0.20f;
    const float g3 = 0.26f + diffNow * 0.18f;
    tank = processAllpass(allpasses[0], tank, g0);
    tank = processAllpass(allpasses[1], tank, g1);
    tank = processAllpass(allpasses[2], tank, g2);
    tank = processAllpass(allpasses[3], tank, g3);

    return std::tanh(tank * 1.1f);
}

void SpringReverbProcessor::process(juce::AudioBuffer<float>& buffer) noexcept
{
    if (!prepared)
        return;

    const int n = buffer.getNumSamples();
    const int ch = buffer.getNumChannels();
    if (n <= 0 || ch <= 0)
        return;

    dryScratch.setSize(ch, n, false, false, true);
    for (int c = 0; c < ch; ++c)
        dryScratch.copyFrom(c, 0, buffer, c, 0, n);

    // Early-out when fully dry and settled
    if (wetGain.getTargetValue() < 1.0e-5f && wetGain.getCurrentValue() < 1.0e-5f)
    {
        wetGain.skip(n);
        decay.skip(n);
        toneDamp.skip(n);
        driveAmt.skip(n);
        diffusion.skip(n);
        flutter.skip(n);
        return;
    }

    for (int i = 0; i < n; ++i)
    {
        float monoIn = 0.0f;
        for (int c = 0; c < ch; ++c)
            monoIn += dryScratch.getSample(c, i);
        monoIn /= (float) ch;

        const float driven = softDrive(monoIn, driveAmt.getNextValue());
        float wet = processTank(driven);

        wet = wetHp.processSample(0, wet);
        wet = wetLp.processSample(0, wet);

        const float g = wetGain.getNextValue();
        const float wetL = wet;
        const float wetR = wet * 0.92f; // narrow authentic spread; mono-safe

        for (int c = 0; c < ch; ++c)
        {
            const float dry = dryScratch.getSample(c, i);
            const float w = (c == 0 || ch == 1) ? wetL : wetR;
            buffer.setSample(c, i, dry + w * g);
        }
    }
}

} // namespace timsamp
