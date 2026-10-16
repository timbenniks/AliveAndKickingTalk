#include "DcBlocker.h"
#include <cmath>

#ifndef M_PI
#define M_PI 3.14159265358979323846
#endif

namespace timsamp
{

void DcBlocker::prepare(double sampleRate)
{
    // ~5 Hz high-pass at typical rates
    const double fc = 5.0;
    r = static_cast<float>(std::exp(-2.0 * M_PI * fc / sampleRate));
    reset();
}

void DcBlocker::reset() noexcept
{
    x1 = y1 = 0.0f;
}

void DcBlocker::process(float* samples, int numSamples) noexcept
{
    for (int i = 0; i < numSamples; ++i)
    {
        const float x = samples[i];
        const float y = x - x1 + r * y1;
        x1 = x;
        y1 = y;
        samples[i] = y;
    }
}

} // namespace timsamp
