#include "RigAudio.h"
#include "dsp/DcBlocker.h"
#include "dsp/NoiseGate.h"
#include <array>
#include <cmath>
#include <cstdio>
#include <cstdlib>
#include <thread>
#include <atomic>
#include <algorithm>
#include <vector>

void check(bool value, const char* message) {
    if (!value) { std::fprintf(stderr, "FAIL: %s\n", message); std::exit(1); }
}
void noiseChecks() {
    timsamp::DcBlocker dc;
    timsamp::NoiseGate gate;
    dc.prepare(48000); gate.prepare(48000); gate.setEnabled(true);
    gate.setThresholdDb(-60); gate.setReleaseMs(100);
    std::array<float, 128> signal, gains, offset;
    for (int b = 0; b < 800; ++b) {
        // Open on a note, then close on quiet DI while the amp has its own residual.
        signal.fill(b < 100 ? 0.1f : 0.00001f);
        offset.fill(0.02f);
        dc.process(offset.data(), 128);
        gate.process(signal.data(), 128, gains.data());
    }
    for (int i = 0; i < 128; ++i) {
        check(std::abs(offset[i]) < 1e-8f, "Output DC filter removes constant model offset");
        check(gains[i] * 0.05f < 1e-8f, "DI envelope suppresses post-amp residual on quiet input");
    }
    for (int b = 0; b < 100; ++b) {
        signal.fill(0.1f); gate.process(signal.data(), 128, gains.data());
    }
    check(gains.back() > 0.999f && signal.back() > 0.0999f, "Gate reopens for the next note");
}

void outputGainChecks(const char* model) {
    // Same capture at +6 and +18 dB: verifies both load and live control ranges.
    void* reference = rig_create(); void* boosted = rig_create();
    char error[1024] {};
    rig_request(reference, 1); rig_request(boosted, 1);
    check(rig_load(reference, model, 1, 0, 6, -85, 0, error, 1024), error);
    check(rig_load(boosted, model, 1, 0, 18, -85, 10, error, 1024), error);
    std::array<float, 128> input, a, b, read;
    for (int phase = 0; phase < 3; ++phase) {
        if (phase == 1) rig_controls(boosted, 0, 6, -85, 10, 0);
        if (phase == 2) rig_controls(boosted, 0, 18, -85, 10, 0);
        double expectedEnergy = 0, errorEnergy = 0;
        const float ratio = phase == 1 ? 1.0f : std::pow(10.0f, 12.0f / 20.0f);
        for (int block = 0; block < 800; ++block) {
            for (int i = 0; i < 128; ++i)
                input[i] = 0.0001f * std::sin(float(block * 128 + i) * 0.03f);
            rig_render(reference, input.data(), a.data(), nullptr, 128);
            rig_render(boosted, input.data(), b.data(), nullptr, 128);
            rig_read(reference, read.data(), 128); rig_read(boosted, read.data(), 128);
            if (block > 600) for (int i = 0; i < 128; ++i) {
                expectedEnergy += double(a[i] * ratio) * (a[i] * ratio);
                errorEnergy += double(b[i] - a[i] * ratio) * (b[i] - a[i] * ratio);
            }
        }
        check(expectedEnergy > 1e-12 && errorEnergy < expectedEnergy * 1e-5,
              "Loaded/live output gain exceeds +6 dB; legacy spring amount has no effect");
    }
    rig_controls(boosted, 0, 24, -85, 0, 0);
    for (int block = 0; block < 200; ++block) {
        for (int i = 0; i < 128; ++i) input[i] = 0.5f * std::sin(float(block * 128 + i) * 0.03f);
        rig_render(boosted, input.data(), b.data(), nullptr, 128);
        for (auto x : b) check(std::isfinite(x) && std::abs(x) <= 0.892f, "+24 dB retains limiter protection");
    }
    rig_destroy(reference); rig_destroy(boosted);
    std::puts("PASS: post-amp noise control, +18 dB load/live gain, +24 dB limiting, legacy spring bypass");
}
int main(int argc, char** argv) {
    noiseChecks();
    void* rig = rig_create();
    std::array<float, 128> in, left, right, read;
    for (int i = 0; i < 128; ++i) in[i] = 0.1f * std::sin(float(i) * 0.03f);
    rig_render(rig, in.data(), left.data(), right.data(), 128);
    for (auto x : left) check(x == 0, "No amp must produce silence, not DI");
    check(rig_read(rig, read.data(), 128) == 128 && read == in, "Detector receives unmodified DI");
    char error[1024] {};
    rig_request(rig, 1);
    check(!rig_load(rig, "/missing/model.nam", 1, 0, -12, -70, 2, error, 1024), "Missing model rejected");
    for (int i = 0; i < 200; ++i) rig_render(rig, in.data(), left.data(), right.data(), 128);
    check(rig_dropped(rig) > 0, "Bounded detection queue reports overflow");
    if (argc > 1) {
        outputGainChecks(argv[1]);
        check(rig_load(rig, argv[1], 1, 0, -12, -70, 2, error, 1024), error);
        double energy = 0;
        for (int b = 0; b < 200; ++b) {
            rig_render(rig, in.data(), left.data(), right.data(), 128);
            for (auto x : left) { check(std::isfinite(x) && std::abs(x) <= 0.9f, "Finite limited output"); energy += x*x; }
            rig_read(rig, read.data(), 128);
        }
        check(energy > 0.000001 && rig_active_generation(rig) == 1, "Real NAM produces audio");
        rig_request(rig, 2);
        check(!rig_load(rig, "/missing/model.nam", 2, 0, -12, -70, 2, error, 1024), "Bad swap rejected");
        rig_render(rig, in.data(), left.data(), right.data(), 128);
        check(rig_active_generation(rig) == 1, "Bad swap retains current amp");
        RigEffectsParameters fx {1, 1, 1, 380, 0.32f, 0.2f, 0.45f, 1, 1, 0.65f, 25, 0.18f, 0.45f, 1, 0.3f};
        rig_controls(rig, 0, -12, -70, 0, 0);
        rig_effects_controls(rig, &fx);
        while (rig_read(rig, read.data(), 128) > 0) {}
        std::vector<double> times;
        double stereoEnergy = 0;
        for (int b = 0; b < 4000; ++b) {
            rig_collect(rig);
            rig_render(rig, in.data(), left.data(), right.data(), 64);
            times.push_back(rig_callback_ms(rig));
            check(rig_read(rig, read.data(), 64) == 64, "Effects retain DI queue delivery");
            for (int i = 0; i < 64; ++i) {
                check(read[i] == in[i], "Effects never reach note detector input");
                check(std::isfinite(left[i]) && std::isfinite(right[i]) && std::abs(left[i]) <= 0.9f && std::abs(right[i]) <= 0.9f,
                      "NAM plus effects output is finite and limited");
                stereoEnergy += double(left[i]-right[i]) * (left[i]-right[i]);
            }
        }
        check(stereoEnergy > 1e-6, "Live effects controls reach production stereo output");
        std::sort(times.begin(), times.end());
        std::printf("NAM + effects offline 64-sample callback: p99 %.3f ms, max %.3f ms (1.333ms audio budget).\n", times[times.size()*99/100], times.back());
        in.fill(0);
        double tailEnergy = 0;
        for (int b = 0; b < 600; ++b) {
            rig_render(rig, in.data(), left.data(), right.data(), 128);
            rig_read(rig, read.data(), 128);
            if (b > 400) for (auto x : left) tailEnergy += double(x) * x;
        }
        check(tailEnergy > 1e-10, "Echo/Space tails survive the closed post-amp gate");
        fx.delayEnabled = fx.reverbEnabled = 0;
        fx.delayMix = fx.reverbMix = 0; // Isolate dry output; bypass alone preserves wet tails.
        rig_effects_controls(rig, &fx);
        for (int b = 0; b < 600; ++b) {
            rig_collect(rig); rig_render(rig, in.data(), left.data(), right.data(), 128);
            rig_read(rig, read.data(), 128);
        }
        for (auto x : left) check(std::abs(x) < 1e-8f, "Dry NAM output settles to silence after note release");
        for (int i = 0; i < 128; ++i) in[i] = 0.1f * std::sin(float(i) * 0.03f);
        fx.delayEnabled = fx.reverbEnabled = 1;
        fx.delayMix = 0.2f; fx.reverbMix = 0.18f;
        // Exercise publication/retirement against a genuinely concurrent audio consumer.
        std::atomic<bool> done {false};
        std::thread audio([&] {
            while (!done) {
                rig_render(rig, in.data(), left.data(), right.data(), 128);
                for (auto x : left) check(std::isfinite(x) && std::abs(x) <= 0.9f, "Safe output during swaps");
            }
        });
        for (uint64_t id = 3; id < 9; ++id) {
            rig_request(rig, id);
            check(rig_load_with_effects(rig, argv[1], id, 0, -12, -70, 2, &fx, error, 1024), error);
            rig_effects_controls(rig, &fx);
            rig_collect(rig);
        }
        done.store(true); audio.join();
        for (int b = 0; b < 30; ++b) { rig_collect(rig); rig_render(rig, in.data(), left.data(), right.data(), 128); }
        check(rig_active_generation(rig) == 8, "Latest preset wins");
        rig_controls(rig, 0, -12, -70, 2, 1);
        for (int b = 0; b < 30; ++b) rig_render(rig, in.data(), left.data(), right.data(), 128);
        for (auto x : left) check(x == 0, "Mute silences output");
    }
    rig_destroy(rig);
    std::puts("PASS: audio routing, bounded DI queue, missing-model handling, NAM render and concurrent swaps (when model supplied)");
}
