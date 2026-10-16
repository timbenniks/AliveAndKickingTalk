#include "SafetyLimiter.h"
#include "util/AudioMath.h"
#include <juce_audio_basics/juce_audio_basics.h>
#include <cmath>

namespace timsamp
{

void SafetyLimiter::prepare(double sampleRate) noexcept
{
    const float releaseMs = 50.0f;
    releaseCoeff = std::exp(-1.0f / static_cast<float>(sampleRate * releaseMs * 0.001));
    reset();
}

void SafetyLimiter::reset() noexcept
{
    envelope = 0.0f;
}

void SafetyLimiter::setCeilingDb(float db) noexcept
{
    ceiling = math::dbToGain(juce::jmin(db, -0.1f));
}

void SafetyLimiter::process(float* samples, int numSamples) noexcept
{
    if (!enabled)
        return;

    for (int i = 0; i < numSamples; ++i)
    {
        float x = samples[i];
        float ax = std::fabs(x);
        envelope = ax > envelope ? ax : (releaseCoeff * envelope + (1.0f - releaseCoeff) * ax);
        if (envelope > ceiling)
        {
            clipped.store(true, std::memory_order_relaxed);
            const float g = ceiling / juce::jmax(envelope, 1.0e-6f);
            x *= g;
        }
        samples[i] = juce::jlimit(-ceiling, ceiling, x);
    }
}

void SafetyLimiter::process(juce::AudioBuffer<float>& buffer) noexcept
{
    for (int c = 0; c < buffer.getNumChannels(); ++c)
        process(buffer.getWritePointer(c), buffer.getNumSamples());
}

} // namespace timsamp
