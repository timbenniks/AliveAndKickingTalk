#include "NoiseGate.h"
#include "util/AudioMath.h"
#include <cmath>

namespace timsamp
{

void NoiseGate::prepare(double sampleRate) noexcept
{
    sr = sampleRate;
    reset();
}

void NoiseGate::reset() noexcept
{
    envelope = 0.0f;
    gain = 1.0f;
    open = true;
}

void NoiseGate::setThresholdDb(float db) noexcept
{
    threshold = math::dbToGain(db);
    openThresh = threshold * 1.2f;
    closeThresh = threshold * 0.8f;
}

void NoiseGate::setReleaseMs(float ms) noexcept
{
    const float samples = static_cast<float>(sr * (ms * 0.001));
    releaseCoeff = samples > 1.0f ? std::exp(-1.0f / samples) : 0.0f;
}

void NoiseGate::process(float* samples, int numSamples, float* gains) noexcept
{
    if (!enabled)
    {
        if (gains) for (int i = 0; i < numSamples; ++i) gains[i] = 1.0f;
        return;
    }

    for (int i = 0; i < numSamples; ++i)
    {
        const float absx = std::fabs(samples[i]);
        envelope = absx > envelope ? absx : (releaseCoeff * envelope + (1.0f - releaseCoeff) * absx);

        if (open)
        {
            if (envelope < closeThresh)
                open = false;
        }
        else if (envelope > openThresh)
        {
            open = true;
        }

        const float target = open ? 1.0f : 0.0f;
        gain += 0.002f * (target - gain);
        samples[i] *= gain;
        if (gains) gains[i] = gain;
    }
}

} // namespace timsamp
