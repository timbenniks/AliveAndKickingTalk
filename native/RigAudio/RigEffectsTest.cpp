#include "dsp/RigEffects.h"
#include <cstdio>
#include <cstdlib>
#include <limits>
#include <chrono>
#include <vector>

static void check(bool ok, const char* why) { if (!ok) { std::fprintf(stderr, "FAIL: %s\n", why); std::exit(1); } }
int main() {
    constexpr int block = 64, rate = 48000;
    juce::AudioBuffer<float> audio(2, block);
    RigEffects fx; fx.prepare(rate, block);
    for (int b = 0; b < 100; ++b) {
        for (int c = 0; c < 2; ++c) for (int i = 0; i < block; ++i) audio.setSample(c, i, c == 0 ? 0.13f : -0.07f);
        fx.process(audio);
        for (int i = 0; i < block; ++i) check(audio.getSample(0, i) == 0.13f && audio.getSample(1, i) == -0.07f,
                                            "Disabled effects leave dry samples bit-identical");
    }
    auto p = RigEffects::defaults();
    p.delayEnabled = 1; p.delayTape = 0; p.delayPingPong = 1; p.delayMS = 100;
    p.delayMix = 0.5f; p.feedback = 0.5f; p.ducking = 0;
    fx.set(p);
    for (int b = 0; b < 100; ++b) { audio.clear(); fx.process(audio); }
    double firstL = 0, firstR = 0, secondL = 0, secondR = 0, premature = 0;
    for (int b = 0; b < 250; ++b) {
        audio.clear(); if (b == 0) { audio.setSample(0, 0, 0.5f); audio.setSample(1, 0, 0.5f); }
        if (b == 50) { p.delayEnabled = 0; fx.set(p); } // stop sends before the first echo
        fx.process(audio);
        for (int i = 0; i < block; ++i) {
            int t = b * block + i; double l = audio.getSample(0, i), r = audio.getSample(1, i);
            if (t > 0 && t < 4799) premature += l*l + r*r;
            if (t >= 4800 && t < 6000) { firstL += l*l; firstR += r*r; }
            if (t >= 9600 && t < 10800) { secondL += l*l; secondR += r*r; }
        }
    }
    check(premature < 1e-10, "100ms delay preserves dry timing and emits no early repeat");
    check(firstL > 1e-5 && firstR < firstL * 0.001 && secondR > 1e-6 && secondL < secondR * 0.01,
          "Ping-pong repeats alternate channels and survive bypass");
    RigEffects space; space.prepare(rate, block);
    p = RigEffects::defaults(); p.reverbEnabled = 1; p.reverbMix = 0.6f; p.preDelayMS = 50; p.ducking = 0;
    space.set(p);
    for (int b = 0; b < 100; ++b) { audio.clear(); space.process(audio); }
    double tail = 0, stereo = 0; premature = 0;
    std::vector<double> times;
    for (int b = 0; b < 3000; ++b) {
        audio.clear(); if (b == 0) { audio.setSample(0, 0, 0.5f); audio.setSample(1, 0, 0.5f); }
        if (b == 100) { p.reverbEnabled = 0; space.set(p); }
        auto start = std::chrono::steady_clock::now(); space.process(audio);
        times.push_back(std::chrono::duration<double, std::micro>(std::chrono::steady_clock::now() - start).count());
        for (int i = 0; i < block; ++i) {
            int t = b*block+i; double l = audio.getSample(0, i), r = audio.getSample(1, i);
            check(std::isfinite(l) && std::isfinite(r), "Reverb tails stay finite");
            if (t > 0 && t < 2400) premature += l*l + r*r;
            if (b > 100) { tail += l*l + r*r; stereo += (l-r)*(l-r); }
        }
    }
    check(premature < 1e-10, "Reverb respects pre-delay");
    check(tail > 1e-5 && stereo > 1e-6, "Stereo reverb retains a tail after bypass");
    RigEffects unducked, ducked; unducked.prepare(rate, block); ducked.prepare(rate, block);
    p = RigEffects::defaults(); p.delayEnabled = 1; p.delayTape = 0; p.delayMS = 50; p.ducking = 0;
    unducked.set(p); p.ducking = 1; ducked.set(p);
    juce::AudioBuffer<float> other(2, block);
    double loudWet = 0, quietWet = 0;
    for (int b = 0; b < 1000; ++b) {
        for (int c = 0; c < 2; ++c) for (int i = 0; i < block; ++i) {
            float x = 0.3f * std::sin(float(b*block+i) * 0.05f);
            audio.setSample(c, i, x); other.setSample(c, i, x);
        }
        unducked.process(audio); ducked.process(other);
        if (b > 800) for (int i = 0; i < block; ++i) {
            float x = 0.3f * std::sin(float(b*block+i) * 0.05f);
            loudWet += std::pow(audio.getSample(0, i)-x, 2); quietWet += std::pow(other.getSample(0, i)-x, 2);
        }
    }
    check(loudWet > 1e-5 && quietWet < loudWet * 0.4, "Ducking reduces wet sound while preserving dry guitar");
    p.feedback = std::numeric_limits<float>::infinity(); p.reverbMix = std::numeric_limits<float>::quiet_NaN();
    auto safe = RigEffects::sanitize(p);
    check(std::isfinite(safe.feedback) && safe.feedback <= 0.85f && std::isfinite(safe.reverbMix), "Bridge rejects nonfinite effects");
    // Extremes and repeated changes exercise smoothing and bounded feedback.
    p = RigEffects::defaults(); p.delayEnabled = p.reverbEnabled = 1;
    p.feedback = 0.85f; p.delayMix = p.reverbMix = 0.6f; p.reverbSize = 1;
    for (int b = 0; b < 3000; ++b) {
        if (b % 20 == 0) {
            p.delayTape = b % 40 == 0; p.delayPingPong = !p.delayTape;
            p.delayMS = b % 60 == 0 ? 20 : 3000; p.preDelayMS = b % 40 == 0 ? 0 : 150;
            space.set(p);
        }
        for (int c = 0; c < 2; ++c) for (int i = 0; i < block; ++i) audio.setSample(c, i, 0.3f * std::sin(float(b*block+i) * 0.05f));
        space.process(audio);
        for (int c = 0; c < 2; ++c) for (int i = 0; i < block; ++i)
            check(std::isfinite(audio.getSample(c,i)) && std::abs(audio.getSample(c,i)) < 8, "Extreme effects remain bounded before limiter");
    }
    std::sort(times.begin(), times.end());
    std::printf("PASS: dry identity, timed stereo echoes, bypass tails, pre-delay, stereo reverb, finite extremes. Effects 64-sample p99 %.1f us, max %.1f us (offline).\n", times[times.size()*99/100], times.back());
}
