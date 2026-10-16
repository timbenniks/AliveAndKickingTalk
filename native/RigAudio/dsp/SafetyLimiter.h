#pragma once

#include <juce_audio_basics/juce_audio_basics.h>
#include <atomic>

namespace timsamp
{

class SafetyLimiter
{
public:
    void prepare(double sampleRate) noexcept;
    void reset() noexcept;
    void setEnabled(bool e) noexcept { enabled = e; }
    void setCeilingDb(float db) noexcept;
    bool wasClipping() const noexcept { return clipped.load(); }
    void clearClipFlag() noexcept { clipped.store(false); }
    void process(float* samples, int numSamples) noexcept;
    void process(juce::AudioBuffer<float>& buffer) noexcept;

private:
    bool enabled = true;
    float ceiling = 0.95f;
    float envelope = 0.0f;
    float releaseCoeff = 0.999f;
    std::atomic<bool> clipped { false };
};

} // namespace timsamp
