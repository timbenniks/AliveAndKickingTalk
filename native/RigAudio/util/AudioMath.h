#pragma once

#include <algorithm>
#include <cmath>
#include <cstdint>

namespace timsamp::math
{

inline float dbToGain(float db) noexcept
{
    return std::pow(10.0f, db * 0.05f);
}

inline float gainToDb(float gain) noexcept
{
    return 20.0f * std::log10(std::max(gain, 1.0e-12f));
}

inline float clamp(float v, float lo, float hi) noexcept
{
    return std::min(hi, std::max(lo, v));
}

inline bool isFiniteSample(float v) noexcept
{
    return std::isfinite(v);
}

inline void sanitizeBuffer(float* data, int numSamples, int& nanCount) noexcept
{
    for (int i = 0; i < numSamples; ++i)
    {
        if (!std::isfinite(data[i]))
        {
            data[i] = 0.0f;
            ++nanCount;
        }
    }
}

} // namespace timsamp::math
