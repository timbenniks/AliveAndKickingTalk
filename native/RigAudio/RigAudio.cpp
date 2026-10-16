#include "RigAudio.h"
#include "dsp/DcBlocker.h"
#include "dsp/NoiseGate.h"
#include "dsp/SafetyLimiter.h"
#include "dsp/RigEffects.h"
#include "util/AudioMath.h"
#include <juce_audio_devices/juce_audio_devices.h>
#include <NAM/get_dsp.h>
#include <NAM/slimmable.h>
#include <array>
#include <atomic>
#include <chrono>
#include <cstdio>
#include <filesystem>

namespace {
constexpr int maxBlock = 4096, ringSize = 16384, fadeSamples = 1440;
constexpr double rate = 48000;
struct Model {
    std::unique_ptr<nam::DSP> dsp;
    uint64_t generation;
    float match = 1, inputDB, outputDB, gateDB;
    RigEffectsParameters effects = RigEffects::defaults();
};

struct EffectsChange { uint64_t generation; RigEffectsParameters settings; };

struct Rig final : juce::AudioIODeviceCallback {
    juce::AudioDeviceManager devices;
    std::array<float, ringSize> ring {};
    std::atomic<uint64_t> write {0}, read {0}, drops {0}, wanted {0}, active {0}, callbacks {0};
    std::atomic<Model*> pending {nullptr}, retired {nullptr};
    std::atomic<EffectsChange*> pendingEffects {nullptr}, retiredEffects {nullptr};
    Model* current = nullptr;
    Model* fading = nullptr;
    int fade = fadeSamples;
    std::atomic<float> inputDB {0}, outputDB {-12}, gateDB {-70};
    std::atomic<bool> muted {false};
    std::atomic<int> fault {0}, blockSize {128};
    std::atomic<double> callbackMS {0};
    juce::AudioBuffer<float> audio {2, maxBlock};
    std::array<float, maxBlock> dry {}, previous {}, gateGain {};
    timsamp::DcBlocker dc, ampDC;
    timsamp::NoiseGate gate;
    timsamp::SafetyLimiter limiter;
    RigEffects effects;
    juce::SmoothedValue<float> inputGain, outputGain;

    Rig() {
        dc.prepare(rate); ampDC.prepare(rate); gate.prepare(rate); gate.setEnabled(true); gate.setReleaseMs(100);
        limiter.prepare(rate); limiter.setCeilingDb(-1);
        effects.prepare(rate, maxBlock);
        inputGain.reset(rate, 0.02); outputGain.reset(rate, 0.02);
        inputGain.setCurrentAndTargetValue(1); outputGain.setCurrentAndTargetValue(0);
    }
    ~Rig() {
        devices.removeAudioCallback(this); devices.closeAudioDevice();
        delete pending.exchange(nullptr); delete retired.exchange(nullptr);
        delete pendingEffects.exchange(nullptr); delete retiredEffects.exchange(nullptr);
        delete current; delete fading;
    }
    void audioDeviceAboutToStart(juce::AudioIODevice* device) override {
        blockSize.store(device->getCurrentBufferSizeSamples());
        fault.store(device->getCurrentSampleRate() == rate && blockSize <= maxBlock ? 0 : 1);
    }
    void audioDeviceStopped() override { fault.store(2); }
    void audioDeviceError(const juce::String&) override { fault.store(3); }
    void audioDeviceIOCallbackWithContext(const float* const* in, int ins, float* const* out,
                                          int outs, int n, const juce::AudioIODeviceCallbackContext&) override {
        for (int c = 0; c < outs; ++c) if (out[c]) juce::FloatVectorOperations::clear(out[c], n);
        if (!ins || !in[0] || !outs || fault.load() || n > maxBlock) return;
        render(in[0], outs > 0 ? out[0] : nullptr, outs > 1 ? out[1] : nullptr, n);
    }
    void render(const float* in, float* left, float* right, int n) noexcept {
        juce::ScopedNoDenormals noDenormals;
        if (n <= 0 || n > maxBlock) return;
        const auto begin = std::chrono::steady_clock::now();
        callbacks.fetch_add(1, std::memory_order_relaxed);
        // One audio producer, one inference consumer. A full ring drops the whole block.
        const auto w = write.load(std::memory_order_relaxed), r = read.load(std::memory_order_acquire);
        if (w - r + n <= ringSize) {
            for (int i = 0; i < n; ++i) ring[(w + i) % ringSize] = in[i];
            write.store(w + n, std::memory_order_release);
        } else drops.fetch_add(1, std::memory_order_relaxed);

        if (!fading && !retired.load(std::memory_order_acquire)) {
            if (auto* next = pending.exchange(nullptr, std::memory_order_acq_rel)) {
                if (next->generation != wanted.load()) retired.store(next, std::memory_order_release);
                else {
                    fading = current; current = next; fade = 0;
                    inputDB.store(next->inputDB); outputDB.store(next->outputDB);
                    gateDB.store(next->gateDB);
                    effects.set(next->effects);
                    active.store(next->generation);
                }
            }
        }
        // Never pass unprocessed DI to the output when no amp is ready.
        if (!current || fault.load()) {
            if (left) std::fill_n(left, n, 0);
            if (right) std::fill_n(right, n, 0);
            return;
        }
        if (!retiredEffects.load(std::memory_order_acquire)) {
            if (auto* change = pendingEffects.exchange(nullptr, std::memory_order_acq_rel)) {
                if (change->generation == current->generation) effects.set(change->settings);
                retiredEffects.store(change, std::memory_order_release);
            }
        }
        audio.setSize(2, n, false, false, true);
        auto* mono = audio.getWritePointer(0);
        std::copy_n(in, n, mono);
        dc.process(mono, n);
        inputGain.setTargetValue(timsamp::math::dbToGain(inputDB.load()));
        for (int i = 0; i < n; ++i) mono[i] *= inputGain.getNextValue();
        gate.setThresholdDb(gateDB.load()); gate.process(mono, n, gateGain.data());
        std::copy_n(mono, n, dry.data());
        try {
            float* src = dry.data(); float* dst = mono;
            current->dsp->process(&src, &dst, n);
            if (fading) {
                src = dry.data(); dst = previous.data();
                fading->dsp->process(&src, &dst, n);
            }
        } catch (...) {
            fault.store(4);
            if (left) std::fill_n(left, n, 0);
            if (right) std::fill_n(right, n, 0);
            return;
        }
        for (int i = 0; i < n; ++i) {
            const float blend = std::min(1.0f, float(fade++) / fadeSamples);
            const float old = fading ? previous[i] * fading->match : 0;
            mono[i] = old * (1 - blend) + mono[i] * current->match * blend;
            if (!std::isfinite(mono[i])) { mono[i] = 0; fault.store(4); }
        }
        fade = std::min(fade, fadeSamples);
        if (fading && fade == fadeSamples) { retired.store(fading, std::memory_order_release); fading = nullptr; }
        // Remove model DC, then reuse the DI gate envelope after the nonlinear amp.
        // Both sit before the effects so closing the gate leaves their tails intact.
        ampDC.process(mono, n);
        for (int i = 0; i < n; ++i) mono[i] *= gateGain[i];
        audio.copyFrom(1, 0, audio, 0, 0, n);
        effects.process(audio);
        outputGain.setTargetValue(muted.load() ? 0 : timsamp::math::dbToGain(outputDB.load()));
        for (int i = 0; i < n; ++i) {
            const auto gain = outputGain.getNextValue();
            for (int c = 0; c < 2; ++c) audio.getWritePointer(c)[i] *= gain;
        }
        limiter.process(audio);
        if (left) std::copy_n(audio.getReadPointer(0), n, left);
        if (right) std::copy_n(audio.getReadPointer(1), n, right);
        callbackMS.store(std::chrono::duration<double, std::milli>(std::chrono::steady_clock::now() - begin).count());
    }
};
void errorText(char* dest, int cap, const std::string& text) {
    if (dest && cap > 0) std::snprintf(dest, size_t(cap), "%s", text.c_str());
}
}

void* rig_create() { return new Rig; }
void rig_destroy(void* p) { delete static_cast<Rig*>(p); }
void rig_stop(void* p) { auto& r = *static_cast<Rig*>(p); r.devices.removeAudioCallback(&r); r.devices.closeAudioDevice(); }
int rig_start(void* p, const char* input, const char* output, int channel, int block, char* error, int cap) {
    auto& r = *static_cast<Rig*>(p);
    auto fail = [&](const juce::String& msg) { errorText(error, cap, msg.toStdString()); r.devices.closeAudioDevice(); return 0; };
    if (channel < 0 || channel > 63 || (block != 64 && block != 128 && block != 256)) return fail("Invalid channel or buffer size.");
    auto err = r.devices.initialise(0, 0, nullptr, false);
    if (err.isNotEmpty()) return fail(err);
    juce::AudioDeviceManager::AudioDeviceSetup setup;
    setup.inputDeviceName = input; setup.outputDeviceName = output;
    setup.sampleRate = rate; setup.bufferSize = block;
    setup.useDefaultInputChannels = false; setup.inputChannels.setBit(channel);
    setup.useDefaultOutputChannels = false; setup.outputChannels.setRange(0, 2, true);
    err = r.devices.setAudioDeviceSetup(setup, true);
    if (err.isNotEmpty()) return fail(err);
    auto* device = r.devices.getCurrentAudioDevice();
    if (!device || device->getCurrentSampleRate() != rate) return fail("This preview needs a 48 kHz audio device.");
    if (!device->getActiveInputChannels()[channel] || device->getActiveOutputChannels().countNumberOfSetBits() < 1)
        return fail("The selected input or output channel is unavailable.");
    r.devices.addAudioCallback(&r);
    return 1;
}
void rig_request(void* p, uint64_t generation) { static_cast<Rig*>(p)->wanted.store(generation); }
int rig_load(void* p, const char* path, uint64_t generation, float input, float output, float gate, float reverb, char* error, int cap) {
    const auto effects = RigEffects::defaults();
    return rig_load_with_effects(p, path, generation, input, output, gate, reverb, &effects, error, cap);
}
int rig_load_with_effects(void* p, const char* path, uint64_t generation, float input, float output, float gate, float reverb, const RigEffectsParameters* effects, char* error, int cap) {
    auto& r = *static_cast<Rig*>(p);
    try {
        auto m = std::make_unique<Model>();
        m->effects = RigEffects::sanitize(effects ? *effects : RigEffects::defaults());
        nam::DspLoadOptions options; options.prewarm = false;
        m->dsp = nam::get_dsp(std::filesystem::path(path), options);
        if (!m->dsp || m->dsp->GetExpectedSampleRate() != rate) throw std::runtime_error("Choose a 48 kHz NAM model.");
        if (m->dsp->NumInputChannels() != 1 || m->dsp->NumOutputChannels() != 1) throw std::runtime_error("Choose a mono NAM capture.");
        if (auto* slim = dynamic_cast<nam::SlimmableModel*>(m->dsp.get())) slim->SetSlimmableSize(1);
        m->dsp->SetPrewarmOnReset(false); m->dsp->Reset(rate, maxBlock); m->dsp->prewarm();
        if (m->dsp->HasLoudness()) m->match = timsamp::math::dbToGain(std::clamp(-24.0f - float(m->dsp->GetLoudness()), -24.0f, 24.0f));
        m->generation = generation; m->inputDB = std::clamp(input, -24.0f, 24.0f);
        m->outputDB = std::clamp(output, -60.0f, 24.0f); m->gateDB = std::clamp(gate, -85.0f, -30.0f);
        if (r.wanted.load() != generation) return 2;
        delete r.pending.exchange(m.release(), std::memory_order_acq_rel);
        return 1;
    } catch (const std::exception& ex) { errorText(error, cap, ex.what()); return 0; }
      catch (...) { errorText(error, cap, "NAM could not load this model."); return 0; }
}
void rig_controls(void* p, float input, float output, float gate, float reverb, int muted) {
    auto& r = *static_cast<Rig*>(p);
    r.inputDB.store(std::clamp(input, -24.0f, 24.0f)); r.outputDB.store(std::clamp(output, -60.0f, 24.0f));
    r.gateDB.store(std::clamp(gate, -85.0f, -30.0f)); r.muted.store(muted != 0);
}
void rig_mute(void* p, int muted) { static_cast<Rig*>(p)->muted.store(muted != 0); }
void rig_effects_controls(void* p, const RigEffectsParameters* settings) {
    auto& r = *static_cast<Rig*>(p);
    // Allocate on the control thread; the detector worker destroys consumed commands.
    // Rapid edits replace only snapshots the audio thread has not taken.
    auto* change = new EffectsChange {r.active.load(), RigEffects::sanitize(settings ? *settings : RigEffects::defaults())};
    delete r.pendingEffects.exchange(change, std::memory_order_acq_rel);
}
int rig_read(void* p, float* data, int capacity) {
    auto& r = *static_cast<Rig*>(p);
    const auto pos = r.read.load(std::memory_order_relaxed), w = r.write.load(std::memory_order_acquire);
    const auto n = int(std::min<uint64_t>(w - pos, std::max(0, capacity)));
    for (int i = 0; i < n; ++i) data[i] = r.ring[(pos + i) % ringSize];
    r.read.store(pos + n, std::memory_order_release);
    return n;
}
void rig_collect(void* p) {
    auto& r = *static_cast<Rig*>(p);
    delete r.retired.exchange(nullptr, std::memory_order_acq_rel);
    delete r.retiredEffects.exchange(nullptr, std::memory_order_acq_rel);
}
uint64_t rig_dropped(void* p) { return static_cast<Rig*>(p)->drops.load(); }
uint64_t rig_active_generation(void* p) { return static_cast<Rig*>(p)->active.load(); }
uint64_t rig_callbacks(void* p) { return static_cast<Rig*>(p)->callbacks.load(); }
int rig_fault(void* p) { return static_cast<Rig*>(p)->fault.load(); }
int rig_buffer_size(void* p) { return static_cast<Rig*>(p)->blockSize.load(); }
double rig_callback_ms(void* p) { return static_cast<Rig*>(p)->callbackMS.load(); }
void rig_render(void* p, const float* in, float* left, float* right, int n) { static_cast<Rig*>(p)->render(in, left, right, n); }
