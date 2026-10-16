#pragma once

#include <juce_dsp/juce_dsp.h>
#include <array>
#include <vector>

namespace timsamp
{

/**
 * Post-NAM spring tank for full-stack amp captures.
 * Parallel wet path only: dry stays at unity; wet is driven, sprung, and speaker-band filtered.
 */
class SpringReverbProcessor
{
public:
    void prepare(const juce::dsp::ProcessSpec& spec);
    void reset() noexcept;

    /** Amp-style Reverb knob, 0..10. */
    void setAmount(float amount0to10) noexcept;

    /** In-place: leaves dry at unity, adds filtered spring return. */
    void process(juce::AudioBuffer<float>& buffer) noexcept;

private:
    static constexpr int kLines = 5;
    static constexpr int kAllpasses = 4;

    struct Line
    {
        std::vector<float> buf;
        int write = 0;
        int length = 1;
        float lp = 0.0f;
    };

    struct Allpass
    {
        std::vector<float> buf;
        int write = 0;
        int length = 1;
    };

    void resizeBuffers();
    void updateTargetsFromAmount(float amount) noexcept;
    float readInterpolated(const std::vector<float>& buf, int write, int length, float delaySamples) const noexcept;
    float processAllpass(Allpass& ap, float x, float g) noexcept;
    float processTank(float x) noexcept;
    float softDrive(float x, float drive) const noexcept;

    std::array<Line, kLines> lines;
    std::array<Allpass, kAllpasses> allpasses;

    juce::dsp::StateVariableTPTFilter<float> wetHp;
    juce::dsp::StateVariableTPTFilter<float> wetLp;

    juce::AudioBuffer<float> dryScratch;

    float sampleRate = 48000.0f;
    float hpState = 0.0f;
    float modPhase = 0.0f;
    float modInc = 0.0f;

    juce::SmoothedValue<float> wetGain { 0.0f };
    juce::SmoothedValue<float> decay { 0.45f };
    juce::SmoothedValue<float> toneDamp { 0.5f };
    juce::SmoothedValue<float> driveAmt { 0.0f };
    juce::SmoothedValue<float> diffusion { 0.5f };
    juce::SmoothedValue<float> flutter { 1.0f };

    bool prepared = false;
};

} // namespace timsamp
