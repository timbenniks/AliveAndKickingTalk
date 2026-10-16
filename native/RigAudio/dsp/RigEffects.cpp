#include "RigEffects.h"
#include <cmath>

RigEffectsParameters RigEffects::defaults() noexcept {
    return {0, 1, 0, 380, 0.32f, 0.2f, 0.45f, 0, 1, 0.65f, 25, 0.18f, 0.45f, 1, 0.3f};
}
RigEffectsParameters RigEffects::sanitize(RigEffectsParameters p) noexcept {
    const auto d = defaults();
    auto valid = [](float x, float lo, float hi, float fallback) {
        return std::isfinite(x) ? std::clamp(x, lo, hi) : fallback;
    };
    p.delayEnabled = p.delayEnabled != 0; p.delayTape = p.delayTape != 0; p.delayPingPong = p.delayPingPong != 0;
    p.reverbEnabled = p.reverbEnabled != 0; p.reverbHall = p.reverbHall != 0;
    p.delayMS = valid(p.delayMS, 20, 3000, d.delayMS);
    p.feedback = valid(p.feedback, 0, 0.85f, d.feedback);
    p.delayMix = valid(p.delayMix, 0, 0.6f, d.delayMix);
    p.delayTone = valid(p.delayTone, 0, 1, d.delayTone);
    p.reverbSize = valid(p.reverbSize, 0, 1, d.reverbSize);
    p.preDelayMS = valid(p.preDelayMS, 0, 150, d.preDelayMS);
    p.reverbMix = valid(p.reverbMix, 0, 0.6f, d.reverbMix);
    p.reverbTone = valid(p.reverbTone, 0, 1, d.reverbTone);
    p.width = valid(p.width, 0, 1, d.width);
    p.ducking = valid(p.ducking, 0, 1, d.ducking);
    return p;
}
void RigEffects::prepare(double rate, int maxBlock) {
    sampleRate = rate;
    juce::dsp::ProcessSpec spec {rate, static_cast<juce::uint32>(maxBlock), 2};
    echo.setMaximumDelayInSamples(int(rate * 3.1)); echo.prepare(spec);
    preDelay.setMaximumDelayInSamples(int(rate * 0.16)); preDelay.prepare(spec);
    room.setSampleRate(rate); room.reset();
    for (auto* f : {&echoLP, &echoHP, &roomLP, &roomHP}) { f->prepare(spec); f->setResonance(0.707f); }
    echoHP.setType(juce::dsp::StateVariableTPTFilterType::highpass); echoHP.setCutoffFrequency(100);
    roomHP.setType(juce::dsp::StateVariableTPTFilterType::highpass); roomHP.setCutoffFrequency(150);
    echoLP.setType(juce::dsp::StateVariableTPTFilterType::lowpass);
    roomLP.setType(juce::dsp::StateVariableTPTFilterType::lowpass);
    for (auto* s : {&delayTime, &preTime, &feedback, &delaySend, &reverbSend, &delayMix, &reverbMix, &pingPong, &tape, &duck})
        s->reset(rate, 0.05);
    delayTime.setCurrentAndTargetValue(settings.delayMS * float(rate) / 1000);
    preTime.setCurrentAndTargetValue(settings.preDelayMS * float(rate) / 1000);
    delaySend.setCurrentAndTargetValue(0); reverbSend.setCurrentAndTargetValue(0);
    attack = std::exp(-1.0f / float(rate * 0.005));
    release = std::exp(-1.0f / float(rate * 0.25));
    set(settings);
}
void RigEffects::set(RigEffectsParameters p) noexcept {
    settings = sanitize(p);
    delayTime.setTargetValue(settings.delayMS * float(sampleRate) / 1000);
    preTime.setTargetValue(settings.preDelayMS * float(sampleRate) / 1000);
    feedback.setTargetValue(settings.feedback);
    delaySend.setTargetValue(float(settings.delayEnabled)); reverbSend.setTargetValue(float(settings.reverbEnabled));
    delayMix.setTargetValue(settings.delayMix); reverbMix.setTargetValue(settings.reverbMix);
    pingPong.setTargetValue(float(settings.delayPingPong)); tape.setTargetValue(float(settings.delayTape)); duck.setTargetValue(settings.ducking);
    echoLP.setCutoffFrequency(1000 + settings.delayTone * 11000);
    roomLP.setCutoffFrequency(1500 + settings.reverbTone * 10500);
    juce::Reverb::Parameters pRoom;
    // Two useful ranges of JUCE's FreeVerb-based stereo tank, not physical room IRs.
    pRoom.roomSize = settings.reverbHall ? 0.55f + settings.reverbSize * 0.4f : 0.1f + settings.reverbSize * 0.5f;
    pRoom.damping = 0.85f - settings.reverbTone * 0.65f;
    pRoom.width = settings.width; pRoom.dryLevel = 0; pRoom.wetLevel = 1.0f / 3; pRoom.freezeMode = 0;
    room.setParameters(pRoom);
}
void RigEffects::process(juce::AudioBuffer<float>& audio) noexcept {
    juce::ScopedNoDenormals noDenormals;
    const int n = audio.getNumSamples();
    auto* l = audio.getWritePointer(0); auto* r = audio.getWritePointer(1);
    for (int i = 0; i < n; ++i) {
        const float ms = delayTime.getNextValue(), warm = tape.getNextValue(), stereo = pingPong.getNextValue();
        phase += float(juce::MathConstants<double>::twoPi * 0.43 / sampleRate);
        if (phase >= juce::MathConstants<float>::twoPi) phase -= juce::MathConstants<float>::twoPi;
        const float wobble = std::sin(phase) * warm * float(sampleRate * 0.0006);
        float dl = echo.popSample(0, std::max(1.0f, ms + wobble));
        float dr = echo.popSample(1, std::max(1.0f, ms - wobble));
        dl = echoLP.processSample(0, echoHP.processSample(0, dl));
        dr = echoLP.processSample(1, echoHP.processSample(1, dr));
        // Saturation only colours repeats; unity slope keeps the feedback bounded.
        dl += warm * (std::tanh(dl * 1.8f) / 1.8f - dl);
        dr += warm * (std::tanh(dr * 1.8f) / 1.8f - dr);
        const float fb = feedback.getNextValue(), send = delaySend.getNextValue();
        echo.pushSample(0, l[i] * send + (dl * (1 - stereo) + dr * stereo) * fb);
        echo.pushSample(1, r[i] * send * (1 - stereo) + (dr * (1 - stereo) + dl * stereo) * fb);
        const float level = std::max(std::abs(l[i]), std::abs(r[i]));
        const float coefficient = level > envelope ? attack : release;
        envelope = coefficient * envelope + (1 - coefficient) * level;
        const float duckGain = 1 / (1 + duck.getNextValue() * envelope * 12);
        const float dm = delayMix.getNextValue() * duckGain;
        l[i] += dl * dm; r[i] += dr * dm;
        const float rs = reverbSend.getNextValue(), pd = preTime.getNextValue();
        preDelay.pushSample(0, l[i] * rs); preDelay.pushSample(1, r[i] * rs);
        float wl = preDelay.popSample(0, pd), wr = preDelay.popSample(1, pd);
        room.processStereo(&wl, &wr, 1);
        const float rm = reverbMix.getNextValue() * duckGain;
        l[i] += roomLP.processSample(0, roomHP.processSample(0, wl)) * rm;
        r[i] += roomLP.processSample(1, roomHP.processSample(1, wr)) * rm;
    }
}
