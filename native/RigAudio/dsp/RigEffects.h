#pragma once
#include "../RigAudio.h"
#include <juce_dsp/juce_dsp.h>

// All methods belong to the audio thread, except prepare before playback.
// Bypass stops new sends; the existing buffers keep ringing. The dry path is unity.
class RigEffects {
public:
    static RigEffectsParameters defaults() noexcept;
    static RigEffectsParameters sanitize(RigEffectsParameters p) noexcept;
    void prepare(double rate, int maxBlock);
    void set(RigEffectsParameters p) noexcept;
    void process(juce::AudioBuffer<float>& audio) noexcept;
private:
    double sampleRate = 48000;
    RigEffectsParameters settings = defaults();
    juce::dsp::DelayLine<float> echo, preDelay;
    juce::Reverb room;
    juce::dsp::StateVariableTPTFilter<float> echoLP, echoHP, roomLP, roomHP;
    juce::SmoothedValue<float> delayTime, preTime, feedback, delaySend, reverbSend,
        delayMix, reverbMix, pingPong, tape, duck;
    float envelope = 0, attack = 0, release = 0, phase = 0;
};
