# Native rig v2: Bogner live tone, cabinet IRs, EQ and noise control

Status: implementation spec
Target: `native/GuitarMIDI` and `native/RigAudio`
Goal: replace the Fender Deluxe Reverb-centric live preset catalog with a Bogner Ecstasy (BOG XT) based rig suitable for the Alive & Kicking rock set.
Non-goal: pre-amp boost or overdrive pedal. Do not implement one.

## Context and decisions

The existing Fender captures sound good but are too noisy and lack the aggressive, tight sounds needed for songs such as Enter Sandman, Beat It, You Give Love a Bad Name and Kickstart My Heart. Captured amp tone is difficult to EQ using the current app.

Choose one Bogner-centered live bank for the show, not a hard-coded Bogner-only engine. Keep generic .nam loading and the ability to use other models later. Treat the current Fender presets as legacy: back them up or leave the existing user file untouched, but make Bogner the new default demo/live catalog once the assets are provided.

The Amalgam BOG XT DI pack contains amplifier-only captures, not a miked speaker sound. The included cabinet IRs must be supported. Purchased .nam and .wav assets MUST stay local and MUST NOT be committed to the public repository.

**Purchase/import gate:** inspect actual BOG XT files for .nam architecture, expected sample rate (native loader currently demands 48 kHz), and mono input/output. Do not assume V2 means A2. Do not claim the pack is fully compatible until representative files load, render and pass performance checks. If unsupported, report the specific limitation and evaluate a safe sample-rate conversion strategy or another capture pack, rather than silently resampling metadata.

## Existing implementation verified on main (2026-10-16)

- `native/RigAudio/RigAudio.cpp`: JUCE AudioDeviceManager callback at 48 kHz; mono NAM DSP via `nam::get_dsp`, asynchronous model load, 1440-sample model switch crossfade, input gain, gate, post-NAM DC blocker, stereo effects, output gain and -1 dBFS limiter.
- `native/RigAudio/CMakeLists.txt`: links `juce::juce_dsp` and compiles NAM core with `NAM_ENABLE_A2_FAST`.
- `native/RigAudio/dsp/NoiseGate.*`: existing gate. `gateGain` calculated from DI is also applied after NAM, potentially clipping note tails.
- `native/RigAudio/dsp/RigEffects.*`: delay and reverb, NO cabinet convolution and NO general parametric EQ.
- `native/GuitarMIDI/RigPresets.swift`: `RigPreset` holds one basename-only .nam file and MIDI program; saved presets at `~/Library/Application Support/Alive Rig Preview/presets.json`; old preset decoding already falls back for absent effects.
- `native/GuitarMIDI/RigState.swift`: defaults to `~/Music/Tims Amp/Models/Amps/Deluxe Reverb`; bundled `deluxe-reverb-presets.json` seeds first-run presets; existing presets should never be overwritten.
- `native/GuitarMIDI/RigSession.swift`: model loads happen on a worker; notes are detected on a separate 10 ms worker from raw DI ring buffer.
- `native/GuitarMIDI/RigEffectsView.swift`: rack UI for echo and space; MIDI Program Change (channel 1, 0-127) switches presets.

Preserve all of the above real-time safety, MIDI, pitch detection and existing effect behaviors.

## Desired audio signal flow

```text
Guitar / Scarlett input (mono, 48 kHz)
  -> input meter and smoothed input gain
  -> DC blocker
  -> configurable input noise gate (with independent sidechain from raw DI)
  -> NAM amp capture (Bogner DI .nam)
  -> model DC cleanup
  -> cabinet IR convolution (.wav; on by default for DI captures)
  -> post-cabinet 4-band EQ + HPF / LPF
  -> stereo delay and reverb (current rack)
  -> global output gain + safety limiter
  -> interface / PA

Raw DI branches to existing pitch detector BEFORE gate, amp, IR and effects.
```

The placement of gate gain must be evaluated: currently the same preamp envelope is reapplied after NAM. Preserve the clean gate use case, but prevent unnecessary chopping of sustained notes and ensure tails of delay/reverb decay naturally. Gate should NOT mute note-detection samples or clamp FX tails.

## Feature A: cabinet IR engine (P0, required before Bogner live use)

- Use `juce::dsp::Convolution` (already available via JUCE DSP). Load mono and stereo PCM .wav files; reject corrupted/empty/unreasonably long or unsupported inputs with clear errors. Resample IR audio to engine's 48 kHz via JUCE's convolution loading support.
- Place convolution AFTER NAM and BEFORE delay/reverb. Apply to both output channels appropriately; avoid accidental 2x gain from channel duplication. Typical close-mic cab IRs are short. Set a documented maximum length (suggest 500 ms for v1).
- Import/choose a cabinet IR file using a native file picker; copy to a managed user-accessible IR folder or store a stable bookmark. Do not rely on temporary/download folder paths.
- Add `cabinetIR` (file identifier/path) and `cabinetEnabled` to presets. For old presets, preserve behavior: absent IR = bypass. For new DI presets, default enabled and require choosing an IR.
- Show IR filename, enable switch and missing-file warning in UI; never silently play harsh DI amp when an enabled IR is missing. Fail preset activation and retain prior valid sound (or safe mute on cold start).
- **Real-time:** do disk I/O and convolution setup off the audio callback. Prebuild processing state and atomically publish. Keep existing model-switch generation protection; for whole-preset switching, change amp + IR + settings coherently and crossfade or otherwise suppress discontinuities. Do not load a new .wav in the callback.
- Use measured latency/CPU instrumentation. Explicitly determine whether convolution latency needs reporting/compensation (live play priority: low latency).
- Optional later: cab IR mix/polarity and multiple IR blends. Not part of P0.

## Feature B: post-cabinet EQ (P0)

Implement a simple stage-ready tone EQ using JUCE DSP filters, after cab convolution and before spatial effects:
- HPF, adjustable 40-160 Hz, default 70-80 Hz for high-gain rhythm (start at 80); bypassable.
- Bass low shelf centered about 120 Hz, range -12 to +12 dB.
- Mid bell centered around 750-1000 Hz, with adjustable frequency 400-1800 Hz and Q 0.5-2.0, gain -12 to +12 dB.
- Treble high shelf near 3-4 kHz, range -12 to +12 dB.
- Presence bell or shelf near 4-6 kHz, range -12 to +12 dB.
- LPF adjustable 5-12 kHz, default 8-10 kHz for cab tone; bypassable.
- Bypass the whole post-EQ stage, and provide a one-click flat/reset state.
- Smoothing for audible parameter changes; no allocations or coefficient construction on the audio callback. For filter coefficients, calculate on a control thread and swap safe prepared states / safely interpolate parameters as appropriate.
- The controls are output tone-shaping, NOT physical Bogner tone knobs. Label accordingly.
- EQ settings are per preset. Add an optional global output EQ later only if needed by PA/venue; do not conflate it with per-preset EQ in v1.

UI: add a compact `TONE` rack with Bass, Mid Gain, Mid Frequency, Treble, Presence, Low Cut, High Cut and bypass. Show dB, Hz/kHz values. Keep existing tolex/pixel rack visual language and reasonable keyboard access.

## Feature C: noise floor investigation and controls (P1, but measure before redesign)

Before changing the DSP:
1. Measure interface input noise with guitar plugged in, strings muted, then cable disconnected appropriately, with documented Scarlett instrument mode/input gain.
2. Measure silence/noise before NAM, after NAM, after IR, after EQ at several gain states; capture RMS/peak dBFS over a bounded diagnostic period off the real-time thread.
3. Establish whether hiss originates from DI/interface, captured amplifier model, or later processing. A gate cannot remove baked-in capture hiss *while notes are sounding*.
4. Check current gain matching: NAM `GetLoudness()` auto-match target (-24 dB) can change perceived hiss; maintain headroom and avoid compensating noise with excessive gain.

Provide safe live gate controls:
- threshold (already exists), attack and release (initially expose a small, sensible range), enable/bypass
- optional hysteresis/hold if audible chatter occurs
- gate reduction meter/indicator and input/output meter, displayed on non-RT UI cadence
- a sensible aggressive-rock default that retains long notes and stops between-song hiss
- preserve MIDI detector from raw DI; it should not be fed the gated model output

Avoid aggressive always-on post-NAM gating that cuts sustain. Keep delay/reverb tails. No promise of noise-free distortion.

## Feature D: Bogner capture import and preset bank (P0)

Do NOT replace generic .nam support with hard-coded paths or check in purchased model files.

- Add a model-pack import action: select folder, list .nam files and supported IR .wav files, validate files with existing NAM loader, show compatibility/errors, and register usable captures. Initial v1 can be manual import of one model and one IR if full batch import is too large.
- Support meaningful organization: model pack / amp / capture variant, rather than a folder named `Deluxe Reverb`; choose a neutral default e.g. `~/Music/Tims Amp/Models`.
- Update the seeded catalog from bundled Deluxe Reverb-specific data to neutral/default or Bogner user-provided catalog. Do not overwrite migrated saved presets. Define migration once per install using versioned decoding and backfilled defaults. Preserve MIDI program numbers for existing users unless explicitly remapped.
- Proposed stage starting bank, using actual available BOG XT variants only after inspection:
  - Program 0: clean / edge-of-breakup
  - Program 1: bright crunch (Beat It rhythm)
  - Program 2: 80s lead crunch (You Give Love a Bad Name)
  - Program 3: tight heavy rhythm (Enter Sandman)
  - Program 4: heavy rhythm / lead (Kickstart My Heart)
  - Program 5: solo lift (same or higher gain model, output +2 to +3 dB if safe)
- These are sound-design targets, not asserted product filenames or guaranteed precise original artist tones.
- Keep program changes from song chapters and existing NAM model crossfade; no accidental automatic remapping of chapter MIDI commands.
- Audit default output dB so switching captures does not produce dangerous jumps. Per-preset volume calibration, with peak/RMS meter and limiter remaining final, is mandatory for stage readiness.

## UX / data design

Extend `RigPreset` with backward-compatible default-decoded optional `cabinetIR`, `cabinetEnabled`, `postEQ`, and `gateSettings`; validate ranges and paths. Do not break old presets JSON or destroy existing files. Existing `RigEffectSettings` stays unchanged when possible.

Suggested managed directories:
```
~/Music/Tims Amp/Models/<pack>/<capture>.nam
~/Music/Tims Amp/IRs/<pack>/<cabinet>.wav
~/Library/Application Support/Alive Rig Preview/presets.json
```
Avoid path traversal, symlink escapes, and path ambiguity. Keep imported licensed assets out of git via gitignore where applicable. Show precise errors for missing models/IRs.

Incrementally extend C ABI (`RigAudio.h`) with stable structs or versioned functions for cab and EQ. Do not break running references or use Swift-owned buffers across asynchronous loads. Keep all ownership unambiguous and tear down loader/audio threads before destroying the DSP engine.


## NAM reference implementation alignment (P0 before live release)

Reference material to inspect against the **exact pinned NeuralAmpModelerCore commit**, not just latest online docs:

- https://www.neuralampmodeler.com/builders
- https://github.com/sdatkinson/NeuralAmpModelerPlugin
- https://github.com/sdatkinson/NeuralAmpModelerCore
- https://neuralampmodelercore.readthedocs.io/en/latest/api/dsp.html

The observations below are code-review findings, **not yet confirmed runtime defects**. Re-check plugin source and model metadata behavior at implementation time. Do not blindly copy plugin logic without reconciling the exact API and calibration units.

### NAM-1: optional calibrated input gain

Current native code applies a user-set input dB value before NAM but does not consult capture input-level metadata. Compare with the official plugin's input calibration behavior and implement an **opt-in** calibrated mode:

- Explicit modes: `manual` (legacy default) and `calibrated` (enabled only when model metadata and an actual interface calibration value are available).
- Determine and document capture input-level metadata semantics, units and any offsets from the official plugin and pinned core source, especially `HasInputLevel()` / `GetInputLevel()` where available.
- Set Scarlett/interface calibration as a user-provided measured/reference value **in the expected units**; do not manufacture a fixed dBu number or confuse digital dBFS with analog dBu.
- Apply the correct difference as an additional **pre-NAM** gain with smooth transitions; display model level, interface reference, calculated correction and clipping/headroom warnings.
- Missing/invalid capture metadata or unconfigured interface calibration: fall back to manual with an explicit UI explanation. Preserve legacy presets' exact input behavior by default.
- Test calibrated vs manual using controlled sine/DI recordings and verify the capture's distortion/saturation responds consistently with the official plugin.

### NAM-2: selectable output level modes

Current `RigAudio.cpp` uses `HasLoudness()` to force a custom approximate **-24 dB target**, with clamped correction. This is not a universal required NAM normalization rule.

- Implement selectable `legacy` (preserve old preset sound), `raw`, and `normalized` output modes. Investigate and optionally support a `calibrated` mode if metadata and reference semantics are verified.
- Compare actual NAM reference-plugin normalization target and loudness units from its **current source**; earlier review suggested **-18 dB**, but treat that as a hypothesis to verify, not a blindly hard-coded invariant.
- Normalize only where appropriate metadata is present. If absent, show a clear fallback. Prevent unexpected loudness boosts and overshoot.
- Separate capture loudness normalization from user output gain and solo level lift. Final limiter remains in place; never treat limiter activity as a substitute for matching preset levels.
- Add per-preset gain/peak/RMS tests at fixed DI input and an automated report of relative output levels. Verify 2-3 dB solo lift is applied **after** capture processing without added distortion.

### NAM-3: model sample rates and channel compatibility

Hardware remains fixed at 48 kHz. The native loader currently rejects models with `GetExpectedSampleRate() != 48000` and any model not 1-in/1-out.

- Inspect `SupportsArbitrarySampleRate()` in the **pinned** core API and actual official plugin usage.
- Allow compatible models to run at 48 kHz if the model explicitly supports arbitrary processing rates; otherwise evaluate an audio-rate adapter/resampler around NAM off the real-time setup path. Keep deterministic CPU and latency.
- Do **not** change the sample-rate declared in a .nam file to claim compatibility. No sample-rate magic.
- Keep explicit mono restrictions until multichannel behavior is consciously supported. Report architecture, expected rate, input/output channels and validation failures during import.
- Stage release can intentionally remain 48 kHz-only if BOG XT actual files pass, but that is a documented restriction, not an assumed incompatibility of the Scarlett.

### NAM-4: stricter callback and thread-safety audit

- `audio.setSize(2, n, false, false, true)` is currently executed per callback. Replace or verify capacity guarantees and introduce no-allocation assertions/instrumentation in tests. Avoid reallocations even during device buffer-size changes.
- Audit `effects.set()`, `room.setParameters()`, filter coefficient changes, smoothers, crossfade and `current->dsp->process()` for bounded runtime, heap use and data races. Prepare heavyweight changes off-thread, publish immutable/prepared state, and retire old state outside the callback.
- Preserve the generation guard and 1440-sample crossfade while ensuring amp+cab+EQ transitions are coherent, no intermediate naked DI amp reaches the PA, and no freed DSP/IR is touched by the audio thread.
- Quantify rather than assume performance: mean, p95/p99 and worst callback duration under 64/128/256 sample buffers; record xruns, memory allocations, CPU and latency. At 48 kHz the nominal 128-frame callback budget is 2.67 ms, **not** total round-trip latency.
- Test rapid program changes, failed downloads/imports, missing/corrupt models, failed cabinet IR load, muted/unmuted swaps and device restarts.

### NAM-5: noise, gating and signal-level diagnostics

- Verify model behavior with zero-valued input: some amp models generate residual noise even with silent DI. Differentiate genuine input noise, capture/model noise, normalization-induced gain and effect noise using stage meters.
- Current gate envelope is applied before and after NAM; test whether double application shortens sustain and causes pumping. Do not reflexively add another compressor or postamp gate.
- Compare dry DI, post input-gain/gate, post NAM, post cabinet, post EQ and post effects with the same DI recording and levels. Measure idle noise, note tails and peak/RMS values.
- Expose metering at UI-safe cadence without locks or allocations on the realtime thread.
- Document testable instrument gain setup for Scarlett Solo, including Instrument/Hi-Z mode, clipping indicator and level calibration process. The physical interface supports 48 kHz; **NAM file compatibility is a separate question**.

### Bogner BOG XT acceptance rehearsal (P0)

Use actual purchased/downloaded BOG XT NAM files and included IRs. Never commit licensed captures or cabinet IRs to Git.

1. Inspect 3 representative captures (clean, crunch, aggressive) for architecture, expected sample rate, channels, input calibration metadata and loudness metadata; save a **text-only metadata report**, not model assets.
2. Run each through pinned NAM core offline. If a model fails, record its precise error and whether the same file works in the current official NAM plugin; distinguish core version mismatch from bad/corrupt assets.
3. A/B the same capture + IR with official NAM plugin at matched DI/interface input, input calibration, IR and output normalization settings. Match playback loudness before judging tonality or noise.
4. Evaluate riff articulation, palm-muted low-end, decay, sustained lead notes, switching click/noise, clipping and noise between songs. Test actual program changes triggered by show chapters.
5. Run an entire simulated set with backing track and capture changes, at 48 kHz and 128 frames; also test 64 and 256. Verify expected callback timing and audible round-trip latency in the real Scarlett setup.
6. Create at most six stage presets with explicit gain matching and custom post-cab EQ. Prefer one Bogner family for the performance; retain Fender only as a recoverable legacy bank.
7. If file metadata differs or the pack is incompatible, stop before rewriting the loader and document the specific compatibility plan.

### Updated implementation order

1. Baseline/compare pinned core with official plugin; add metadata inspector and controlled offline render tests.
2. Implement optional calibrated input gain and output-level modes **with legacy defaults**; verify with test DI.
3. Implement cabinet convolution as a safe part of preset loading and tests.
4. Add post-cab EQ with smooth parameter update and tone rack UI.
5. Add instrument/model noise diagnostics and tune existing gate based on measurements.
6. Import and validate real Bogner assets; build and level-match the MIDI stage bank.
7. Run complete onstage stability, note-detector isolation, latency and regression tests.

**Out of scope:** an extra compressor or pre-amp boost. Existing safety limiter is not a creative compressor.

## Implementation sequence for the coding agent

1. Add tests and baseline: offline `rig_render` regression with known model, note detector routing, MIDI Program Change, model changes and CPU/callback timing. Record current output and fault behavior.
2. Implement convolution subsystem and unit/offline tests with a generated impulse (identity IR, delayed IR, mono/stereo, missing/invalid IR). Verify no callback allocations or disk reads and bounded latency.
3. Extend preset schema and C ABI; load paired model + IR as a single generation-safe preset operation; keep old presets working.
4. Add Swift IR picker, status and errors; wire cab module with bypass.
5. Implement and test post-cab EQ; add tone rack controls with accurate value display.
6. Implement diagnostic meters and gate improvements based on observed noise; verify note sustain and effect tail behavior.
7. Add generic import/catalog and stage bank configuration for real Bogner files; preserve original Fender data/presets for rollback.
8. Run end-to-end stage rehearsal tests with Scarlett at 48 kHz and 64/128/256-sample buffers; record CPU, latency, peak levels and glitch counts.

## Acceptance criteria

- Compatible 48 kHz mono Bogner .nam and accompanying .wav IR load and sound as one amp+cab rig without a separate plugin.
- Invalid model or IR gives actionable error; no crashes, silent substitution, or unprocessed DI reaching PA. Previous valid sound remains on failed hot-load.
- Existing Fender presets load unchanged when IR/EQ fields are absent; new user data never overwritten.
- EQ controls audibly work, save, reload, MIDI-switch and reset to flat; no zipper noise or unsafe peaks during changes.
- Both clean and high-gain presets have safe, controlled noise between notes while long sustained leads and delay/reverb tails remain audible.
- MIDI chapter Program Changes select the intended saved presets without unintended changes to numbering.
- Note-to-MIDI analysis stays on raw DI, unaffected by cab/EQ/gate modifications.
- Switches are pop-free and playback has no allocation, filesystem I/O, locks, or unbounded computation in the audio callback.
- No clipping or unexpected level jumps across presets; final limiter remains active.
- `rig_audio_test`, `rig_effects_test` and added cab/EQ/migration tests pass, including offline render. GUI smoke test passes.
- Assets from the commercial capture pack are never committed.

## Not in scope

- Pre-amp boost, overdrive, compressor or pedalboard
- Full physical Bogner knob simulation or changing trained capture internals
- Capturing/training NAM models
- Stereo multi-amp routing, multiple blended IRs
- Automatic purchase/download of BOG XT
- Rewriting the existing note detector or web presentation

## Suggested next-day agent prompt

Implement this spec incrementally, first auditing pinned NAM Core vs the official plugin and implementing metadata-aware calibration with legacy-compatible defaults, then cabinet convolution and post-cabinet EQ. Read native/RigAudio and native/GuitarMIDI first; preserve realtime safety and notes-to-MIDI. Add tests per phase, run them, and keep purchased BOG XT assets local. Do not implement a preamp boost. Do not delete legacy Fender presets. Work in small commits and report any actual model file incompatibility instead of guessing.
