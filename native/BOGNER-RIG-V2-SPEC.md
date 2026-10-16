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

Implement this spec incrementally, starting with cabinet IR convolution and backward-compatible preset model. Read native/RigAudio and native/GuitarMIDI first; preserve realtime safety and notes-to-MIDI. Add tests per phase, run them, and keep purchased BOG XT assets local. Do not implement a preamp boost. Do not delete legacy Fender presets. Work in small commits and report any actual model file incompatibility instead of guessing.
