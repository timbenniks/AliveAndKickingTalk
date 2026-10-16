#pragma once

namespace timsamp
{

class DcBlocker
{
public:
    void prepare(double sampleRate);
    void reset() noexcept;
    void process(float* samples, int numSamples) noexcept;

private:
    float x1 = 0.0f;
    float y1 = 0.0f;
    float r = 0.995f;
};

} // namespace timsamp
