# Alive Rig Preview

This is the combined macOS prototype: the existing Alive voxel stage and guitar-to-MIDI detector, plus a NAM amp, spring reverb, saved sound presets and MIDI preset control. It lives in a normal separate clone, not a worktree.

## Preserved baseline

- Source: `AliveAndKickingTalk`, commit `577c3df`, tag `alive-midi-known-good-2026-10-16`.
- Backup directory: `/Users/tim.benniks/Websites/AliveAndKicking/backups/alive-midi-577c3df/`.
- The directory contains the working `Alive Guitar MIDI.zip`, a copy of the app's preferences file, and an independent `AliveAndKickingTalk.bundle` Git backup. The original app does not persist its detector knobs, so the preferences file cannot recover unsaved response settings from a running session.
- App archive SHA-256: `6dceb35e5f33b1d3c6ee37d827553aa4f8e25dab8237892d14ef1e51dd6b98f2`.
- Development: `/Users/tim.benniks/Websites/AliveAndKicking/AliveAndKickingRig`, branch `turbo-tim/alive-rig`.
- The clone's local remote is called `source-checkpoint`; it is not configured to push to the talk's GitHub repository.

The preview has a different app identifier (`live.aliveandkicking.rig-preview`), executable, preferences, preset folder, and MIDI endpoints. It does not replace the original app or change the website's selected ports. Neither original repository's working files were edited.

## Visual contract

`StageStyle.swift`, the voxel stage, icon, and bundled font files are retained. Colors remain night `#100c1c`, tolex `#1e1733`, raised `#2c2348`, bone `#f3ead6`, dust `#a99fbb`, and gold `#ffc531`, with the same six fret colors. Jersey 10, Silkscreen and Barlow Semi Condensed keep their original roles. The new sound panel uses the existing stepped stomp buttons, square panels, typography and colors. The note-response panel is collapsible to make room for sound controls.

## Build and launch

Requires macOS 14+, Xcode command-line tools, CMake and Ninja. This is a locally ad-hoc signed preview.

```sh
bash native/GuitarMIDI/build-rig.sh
open 'native/GuitarMIDI/dist/Alive Rig Preview.app'
```

Dependencies are pinned to JUCE 8.0.14 (`2cdfca8…`) and NeuralAmpModelerCore v0.5.4 (`1f42f88…`), with `NAM_ENABLE_A2_FAST`. CMake fetches these on a fresh build. Compiled dependencies ship inside the app; the installed preview does not need another checkout at runtime.

The original `build.sh` still builds the note-only app inside this separate checkout. Use `build-rig.sh` for the combined preview.

## Use

1. Select the clean guitar input and its channel. Select the interface output connected to your headphones or monitors. The preview uses outputs 1–2 when available.
2. Start at 48 kHz and a 128-sample buffer. The app reports the actual negotiated buffer size. It rejects unsupported sample rates.
3. Select an amp capture. By default, the preview reads the purchased 24-capture Deluxe Reverb collection from `~/Music/Tims Amp/Models/Amps/Deluxe Reverb/`. **Model folder** selects an alternate location for the same catalog. No purchased models are committed or bundled.
4. Click **Start rig**, grant microphone access, and listen through the interface. Disable hardware direct monitoring if you want only the processed amp sound.
5. In the website, select **Alive Rig Preview Notes** for Guitar MIDI input and **Alive Rig Preview Control** for amp output.

The dedicated control destination replaces the IAC route for this preview. It accepts channel 1 Program Changes, with raw program numbers 0–127. It does not subscribe to IAC automatically, avoiding accidental control of both amps. The unchanged website can already select the new output. Incoming unmapped programs are shown without changing sound; MIDI never starts stopped audio.

## Presets

The initial 24 sounds map the catalog to programs 0–23. These assignments are starting points, not a recreation of the existing Neural DSP song mappings. Adjust the program numbers and sounds to match each song.

Saved presets include name, capture filename, MIDI program, input gain, amp gate, spring reverb and output level. **Save preset** updates the selected sound. **Save as new** creates another sound and requires an unused program number. Files are validated and written atomically to:

`~/Library/Application Support/Alive Rig Preview/presets.json`

Duplicate programs, invalid ranges and unsafe model filenames are rejected. An unreadable preset file is preserved and saving is disabled. Input/output selection, note gate/confidence, timing, acceleration and buffer size are global preview preferences. Sound changes do not change note detection or routing.

## Audio architecture

```text
Interface DI (selected channel, 48 kHz)
  ├─ DC filter → input gain → amp gate → NAM → spring → output gain → limiter → interface
  └─ bounded preallocated queue → worker resampling to 22,050 Hz → unchanged Core ML detector
                                                               → Preview Notes MIDI source
Website → Preview Control MIDI destination → saved preset → background model loader
```

The SwiftUI shell is retained. A C bridge calls the JUCE audio-device and NAM engine; no JUCE editor is introduced. The DC filter, gate, spring and limiter sources are copied from `timbenniks-rig` commit `efa73cd`. The original rig's pointer-swap implementation is not used.

Models load and prewarm off the audio thread. The audio thread owns the current and fading models. Atomic pointer mailboxes transfer prepared models and retire old ones; destruction happens off the audio thread. Preset swaps crossfade over 30 ms. The last successfully loaded amp keeps running during loading and on load errors. Before the first model is ready, output is silent. Mute affects amp output while note detection continues.

The detector receives DI before all amp processing. Its model weights, timing and decoder are unchanged. A full queue drops incoming blocks; the detector drains stale samples and releases its notes after a discontinuity. Inference failure releases notes and reports an error while amp audio continues. Audio-device errors or a missing-callback watchdog stop the session and require a manual restart. The preview does not yet copy the note-only app's automatic route recovery.

## Checks

```sh
'native/GuitarMIDI/dist/Alive Rig Preview.app/Contents/MacOS/AliveRigPreview' --self-test
native/RigAudio/build/rig_audio_test
native/RigAudio/build/rig_audio_test '/path/to/a/48k-mono-capture.nam'
'native/GuitarMIDI/dist/Alive Rig Preview.app/Contents/MacOS/AliveRigPreview' --offline-test '/path/to/a/48k-mono-capture.nam'
```

The Swift checks include the original real Core ML chord/riff tests, note release and timing checks, actual CoreMIDI transport, preset persistence and program parsing. The C++ checks cover untouched DI delivery, bounded queue overflow, silence before a model loads, real NAM audio, invalid-model fallback, concurrent switching, mute and finite limited output. They do not open an interface.

The combined offline test feeds synthetic 48 kHz guitar into the production amp and DI queue while the production resampler and Core ML worker run. It switches the model during processing, checks expected notes and eventual release, and asserts zero queue drops. The first run passed with all expected pitches and one extra A4 (the same octave error seen in the original Balanced detector). This checks integration, not real-guitar accuracy or hardware latency.

Hardware acceptance still requires guitar-to-headphones latency, chord accuracy through the new capture route, rapid preset changes, disconnect/reconnect, and a complete rehearsal with the website running. Inference and callback processing durations are not end-to-end latency measurements. The preview currently has the Deluxe Reverb captures and spring reverb; it does not import Neural DSP presets or provide its other effects.

## Validation, 2026-10-16

- Release build and signed app verification passed.
- Original detector self-tests, preset persistence, multi-packet CoreMIDI program delivery, native audio tests and the combined offline test passed.
- All 24 installed catalog captures were confirmed present with 48 kHz metadata.
- Detector source, `StageStyle.swift`, icon and all three font files match the preserved source byte-for-byte. The archived original executable matches the original app.
- Inspected the running preview at both ends of its scroll view. Start/Stop stays visible; startup with no selected audio route stays stopped and gives an actionable message. No microphone or speaker playback was started.
- No JavaScript, TypeScript or website files changed; website build tasks were not needed for this native-only change.
