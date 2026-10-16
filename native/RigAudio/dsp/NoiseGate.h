#pragma once

namespace timsamp
{

class NoiseGate
{
public:
    void prepare(double sampleRate) noexcept;
    void reset() noexcept;
    void setEnabled(bool e) noexcept { enabled = e; }
    void setThresholdDb(float db) noexcept;
    void setReleaseMs(float ms) noexcept;
    void process(float* samples, int numSamples) noexcept;

private:
    bool enabled = false;
    float threshold = 0.01f;
    float openThresh = 0.012f;
    float closeThresh = 0.008f;
    float releaseCoeff = 0.999f;
    float envelope = 0.0f;
    float gain = 1.0f;
    bool open = true;
    double sr = 48000.0;
};

} // namespace timsamp
