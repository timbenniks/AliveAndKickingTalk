#include "RigAudio.h"
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
int main(int argc, char** argv) {
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
