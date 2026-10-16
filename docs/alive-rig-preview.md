# Alive Rig Preview

This is the main native macOS app: the Alive voxel stage and guitar-to-MIDI detector, plus a NAM amp, stereo delay, room/hall reverb, saved sound presets and MIDI preset control. Turning the rig off provides notes-only operation alongside Neural DSP. The legacy spring setting remains in preset data for sound compatibility.

## Preserved baseline

- Source: `AliveAndKickingTalk`, commit `577c3df`, tag `alive-midi-known-good-2026-10-16`.
- Backup directory: `/Users/tim.benniks/Websites/AliveAndKicking/backups/alive-midi-577c3df/`.
- The directory contains the working `Alive Guitar MIDI.zip`, a copy of the app's preferences file, and an independent `AliveAndKickingTalk.bundle` Git backup. The original app does not persist its detector knobs, so the preferences file cannot recover unsaved response settings from a running session.
- App archive SHA-256: `6dceb35e5f33b1d3c6ee37d827553aa4f8e25dab8237892d14ef1e51dd6b98f2`.
- Development originally used `/Users/tim.benniks/Websites/AliveAndKicking/AliveAndKickingRig`, branch `turbo-tim/alive-rig`. The completed app is promoted to `main` in the canonical `AliveAndKickingTalk` checkout.
- The development clone's local remote is called `source-checkpoint`; GitHub publishing uses the canonical checkout.

The combined app retains its identifier (`live.aliveandkicking.rig-preview`), executable, preferences, preset folder and MIDI endpoints through promotion. It replaces the standalone app; it does not automatically change the website's selected ports. The earlier backup remains available for recovery.

## Main promotion, 2026-10-16

The combined app is the default native build on main. The old standalone app bundle is retired to the local Trash; its independent ZIP/source backup above is retained. Current presets were also copied to `backups/main-promotion-20261016/presets.json` outside the repository before promotion. Bundle identity, user settings, saved sounds and both MIDI port names stay unchanged.

Release validation passed: default build/signature verification, Core ML tests in all timing presets and CPU fallback, actual CoreMIDI loopback, preset persistence/validation, display checks, both native CTest targets, real-NAM concurrent model/effect swaps and combined NAM/effects/detector playback. The combined test found every expected pitch, released notes, switched presets and reported zero DI drops across 447 reports. These tests do not replace live rehearsal with the interface and website. No website JavaScript changed in this promotion.

## Visual contract

`StageStyle.swift`, the voxel stage, icon, and bundled font files are retained. Colors remain night `#100c1c`, tolex `#1e1733`, raised `#2c2348`, bone `#f3ead6`, dust `#a99fbb`, and gold `#ffc531`, with the same six fret colors. Jersey 10, Silkscreen and Barlow Semi Condensed keep their original roles. The new sound panel uses the existing stepped stomp buttons, square panels, typography and colors. The window opens at 1280 × 720 and can be resized or presented fullscreen. Notes, input and response controls sit on the left; audio output, amp controls and presets sit on the right. Each side scrolls independently for smaller displays and expanded settings. Advanced note settings and preset editing are collapsible; Start/Stop and the rig on/off switch stay visible.

## Build and launch

Requires macOS 14+, Xcode command-line tools, CMake and Ninja. This is a locally ad-hoc signed preview.

```sh
bash native/GuitarMIDI/build.sh
open 'native/GuitarMIDI/dist/Alive Rig Preview.app'
```

Dependencies are pinned to JUCE 8.0.14 (`2cdfca8…`) and NeuralAmpModelerCore v0.5.4 (`1f42f88…`), with `NAM_ENABLE_A2_FAST`. CMake fetches these on a fresh build. Compiled dependencies ship inside the app; the installed preview does not need another checkout at runtime.

`build.sh` delegates to `build-rig.sh`, so both build the combined app. The retired standalone shell remains in source as a historical detector test harness; the normal build no longer produces its app bundle.

## Use

1. Select the clean guitar input and its channel. Select the interface output connected to your headphones or monitors. The preview uses outputs 1–2 when available.
2. Start at 48 kHz and a 128-sample buffer. The app reports the actual negotiated buffer size. It rejects unsupported sample rates.
3. Select an amp capture. By default, the preview reads the purchased 24-capture Deluxe Reverb collection from `~/Music/Tims Amp/Models/Amps/Deluxe Reverb/`. **Model folder** selects an alternate location for the same catalog. No purchased models are committed or bundled.
4. Click **Start rig**, grant microphone access, and listen through the interface. Disable hardware direct monitoring if you want only the processed amp sound.
5. In the website, select **Alive Rig Preview Notes** for Guitar MIDI input and **Alive Rig Preview Control** for amp output.

The dedicated control destination replaces the IAC route for this preview. It accepts channel 1 Program Changes, with raw program numbers 0–127. It does not subscribe to IAC automatically, avoiding accidental control of both amps. The unchanged website can already select the new output. Incoming unmapped programs are shown without changing sound; MIDI never starts stopped audio.

## Notes only / Neural DSP

Click **Turn rig off** in the bottom transport. The button changes to **Turn rig on**, and the main action becomes **Start notes**. This choice is remembered across launches.

- The left side keeps the original input-only `GuitarCapture` path and unchanged detector. It publishes **Alive Rig Preview Notes** in both modes.
- With the rig off, no NAM engine or model is started and the app produces no audio output. An output device and NAM files are not required. This mode resamples the input's current rate, as the original MIDI app does; the built-in rig's 48 kHz restriction does not apply.
- Open Neural DSP and select your DI input and headphone/monitor output there. In the website, keep Guitar MIDI input on **Alive Rig Preview Notes**, and select **IAC Driver Alive and Kicking** for amp output. Neural DSP must listen to that IAC port. The preview does not change these website or Neural DSP settings automatically.
- The preview ignores incoming amp Program Changes while its rig is off. Saved sounds and the current draft are retained. **Mute amp** remains a separate control for silencing the built-in rig while keeping it loaded.
- Switching modes while running releases held notes, closes the current capture path, then starts the chosen path. Expect a brief interruption and possible MIDI endpoint reconnection. If the required device or capture is unavailable, it stays stopped with an explanation. Mode changes while stopped do not start audio.

If Neural DSP changes the interface's sample rate or the input disconnects, restart notes after checking the route. Simultaneous operation with the actual interface and Neural DSP still needs a hardware rehearsal.

## Presets

The initial 24 sounds map the catalog to programs 0–23. These assignments are starting points, not a recreation of the existing Neural DSP song mappings. Adjust the program numbers and sounds to match each song.

Saved presets include name, capture filename, MIDI program, input gain, amp gate, spring reverb, output level and the complete effects rack (including tempo and note division). Expand **SAVE / MIDI MAPPING** to edit the name and program. **Save preset** updates the selected sound. **Save as new** creates another sound and requires an unused program number. Files are validated and written atomically to:

`~/Library/Application Support/Alive Rig Preview/presets.json`

Duplicate programs, invalid ranges and unsafe model filenames are rejected. An unreadable preset file is preserved and saving is disabled. Input/output selection, note gate/confidence, timing, acceleration and buffer size are global preview preferences. Sound changes do not change note detection or routing.

## Audio architecture

```text
Interface DI (selected channel, 48 kHz)
  ├─ DC filter → input gain → amp gate → NAM → spring → echo → space → output gain → limiter → interface
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

Hardware acceptance still requires guitar-to-headphones latency, chord accuracy through the new capture route, rapid preset changes, disconnect/reconnect, and a complete rehearsal with the website running. Inference and callback processing durations are not end-to-end latency measurements. The preview has the Deluxe Reverb captures, spring and the effects rack described below. It does not import Neural DSP presets or reproduce its algorithms.

## Validation, 2026-10-16

- Release build and signed app verification passed.
- Original detector self-tests, preset persistence, multi-packet CoreMIDI program delivery, native audio tests and the combined offline test passed.
- All 24 installed catalog captures were confirmed present with 48 kHz metadata.
- Detector source, `StageStyle.swift`, icon and all three font files match the preserved source byte-for-byte. The archived original executable matches the original app.
- Inspected the running preview at both ends of its scroll view. Start/Stop stays visible; startup with no selected audio route stays stopped and gives an actionable message. No microphone or speaker playback was started.
- No JavaScript, TypeScript or website files changed; website build tasks were not needed for this native-only change.

## Widescreen and rig-off validation, 2026-10-16

- Built and signed the landscape preview; original Core ML / CoreMIDI tests, mode-specific startup checks, the native NAM audio test and the combined offline test passed (447 reports, expected pitches present, zero DI drops).
- Notes-only startup accepts an input without output selection or NAM files; both modes reject a missing input. Built-in rig startup still requires output and capture.
- Inspected both sides and the rig-off instructions in the running app. Starting without an input gives an actionable message and stays stopped. The off choice survives relaunch.
- Live mode switching, guitar-to-MIDI delivery alongside Neural DSP and interface output still need the hardware acceptance checks above. No microphone capture or speaker playback was started during these checks.

The offline run during UI inspection recorded a 74.6 ms maximum render duration on the ordinary test thread. A repeat with the preview closed and no UI inspection passed with 448 reports, zero drops and a 2.9 ms maximum. These ordinary-thread timings are not a real-time device callback benchmark or evidence of stage-ready latency; measure on the actual interface before the conference.

## Amp panel design, 2026-10-16

The right side now uses a drawn pixel cabinet with a woven grille, Benniks nameplate, gold control strip, and a status light. It keeps the existing colors and fonts; no generated image assets or new dependencies are used. The large preset name and raw MIDI program sit above it, with previous/next buttons and a menu for the full list. Browsing selects a saved preset using the existing loading path and replaces any unsaved draft, just like the previous picker.

Four dials control the same input gain, amp gate, spring reverb and output gain as before. Drag vertically to adjust; keyboard arrows and VoiceOver increment/decrement adjust by 0.5. Values are clamped to the existing ranges. Output has a gold label and readout. There are no cosmetic EQ controls that the capture engine cannot perform. Mute remains separate from turning the rig off.

Expand **SAVE / MIDI MAPPING** to save or rename sounds and assign programs. **AUDIO SETUP** above both panels holds input, channel, output and buffer. **MODEL FOLDER** on the amp side holds the capture-folder chooser and processing time. The notes panel and rig-off behavior are unchanged.

Starter presets still apply −12 dB output gain; this design update does not change existing levels, saved sounds or DSP. Matching Neural DSP loudness needs listening or measurements of both apps with the same DI. Output gain changes volume after the amp; input gain changes how the capture is driven. Save output adjustments per preset once matched. Neural DSP preset files are not imported or converted by this UI.

Validation: release build and signing passed. Inspected the running landscape layout, preset banner, dials and expandable routing controls. Verified output dragging, keyboard and accessibility increments/decrements, and next/previous preset navigation; restored the selected sound and knob values after testing. The audio engine and detector were not modified; no live playback was started for this UI check.

## Stable notes and shared audio setup, 2026-10-16

**AUDIO SETUP** is now a shared section above the two performance panels. Its collapsed row summarizes input, channel, output and buffer. Expand it to change all four in one place while stopped. Output and buffer are disabled in notes-only mode because Neural DSP owns those choices. Device selections and audio behavior are unchanged.

The note monitor keeps the voxel stage in a compact header beside a live-note count. Six permanent display slots reserve one row in silence and while playing. These are detected pitches, not guitar-string assignments. More than six notes show an overflow count; the accessibility description includes every detected pitch, and MIDI still sends every detected note. Removing the second row reduces the monitor height by 38 points. Input level, inference time and drops have reserved space so changing digits cannot move neighboring controls. The two app columns have explicit equal widths; transport status also has reserved height.

Live readings now belong to a separate observable object, rather than publishing several properties through the shared app state on every audio report. Only the note monitor and optional processing-time text observe it. Note changes and releases update immediately; unchanged-note meter refreshes are capped at 30 Hz. This only changes display refreshes, not inference, MIDI or audio processing. Both the built-in amp and notes-only capture feed this same display path.

Regression check:

```sh
'native/GuitarMIDI/dist/Alive Rig Preview.app/Contents/MacOS/AliveRigPreview' --display-test
```

The check verifies immediate note attacks/releases, bounded meter updates, no shared-state notifications from live readings, and unchanged rendered monitor size for silence, 1, 6, 7 and 49 notes at three pane widths. It also varies meter digit lengths and checks that Stop clears readings. It renders the production view without opening audio hardware. A six-note reference render is written to `/tmp/alive-rig-note-monitor.png`.

Validation: signed release build and `--display-test` passed. Inspected the complete app and expanded Audio Setup; confirmed all four selectors are together and that output/buffer disable in notes-only mode. Restored the pre-rebuild unsaved −11.5 dB output adjustment. No live guitar capture was started during these checks.


## Echo and Space effects, 2026-10-16

Expand **EFFECTS** below the amp. The blue **ECHO** and purple **SPACE** panels use the existing pixel palette and fonts; each has its own on/off button. Controls can be prepared while bypassed. **Save preset** stores the whole rack with the current sound; channel 1 Program Changes recall it with the amp. Changes remain drafts until saved.

- **Echo:** digital or tape character, optional ping-pong, 20–2000 ms manual time, feedback (maximum 85%), wet mix (maximum 60%) and tone. Tape adds soft saturation and subtle time modulation to repeats. Time changes glide over 50 ms and can audibly bend pitch.
- **Timing:** milliseconds or quarter, dotted-eighth, eighth and half notes at 40–240 BPM. Tap averages the last four valid intervals and switches manual time to quarter notes. Synced time can reach 3000 ms. Tempo is saved per preset; this version does not receive MIDI Clock or the website's song tempo. Program numbers alone do not communicate tempo.
- **Space:** algorithmic Room/Hall ranges, length, 0–150 ms pre-delay, tone, stereo width and wet mix. This uses JUCE's FreeVerb-based stereo tank with additional filtering and pre-delay. Length is a relative amount, not a measured decay in seconds. It is not convolution, a physical plate emulation, or a copy of Neural DSP's reverb; licensed plate/hall IRs remain a possible later upgrade.
- **Ducking:** reduces the wet echo and space while the post-amp guitar is loud, releasing over about 250 ms. Dry guitar stays at unity through the new rack. The existing spring remains a separate amp control.
- **Tails:** switching either effect off fades its input send, allowing stored repeats/reverb to decay. Preset changes retain the same buffers; the new time, feedback, mix and reverb settings reshape existing tails. This is shared-buffer spillover, not two independently preserved preset engines. Mute silences the complete output; Stop/rig-off discards the session and its tails.

Legacy preset files decode with both new effects off and every existing value unchanged. Loading does not rewrite the file. Malformed effects, nonfinite values and invalid ranges are rejected by preset validation. A backup of the previous signed app, preset file, source diff and Git revision is at `/Users/tim.benniks/Websites/AliveAndKicking/backups/before-effects-20261016-152543/`.

The native effect buffers allocate before playback. The audio callback owns DSP state, applies complete control snapshots and preserves the unprocessed DI queue. UI changes allocate commands outside the callback; the detector worker retires them. Effects saved with a model apply when that model is activated, and stale live edits cannot override a newer model generation. No inference code or website JavaScript changed.

Validation:

- Signed release build, original Core ML/MIDI self-tests, old-preset migration, effects persistence/range validation and display tests passed.
- `native/RigAudio/build/rig_effects_test` checks dry sample identity, echo timing/channel alternation, bypass tails, reverb pre-delay/stereo, ducking and finite output at extreme settings.
- The real-NAM native test exercises live controls, unchanged DI, concurrent model/effects switching and mute. At 64 samples, one offline run measured 0.483 ms p99 and 5.188 ms maximum wall time against a 1.333 ms audio block. Offline scheduling spikes mean this is not a guarantee of glitch-free 64-sample hardware playback.
- The existing six-note monitor test still passes at three widths. An expanded effects rack render is written to `/tmp/alive-rig-effects.png` for visual inspection.
- The combined detector/NAM test passed with both effects enabled: all expected pitches, note release, preset switching and zero DI queue drops (436 reports). An initial run with the live preview also processing missed pitch 45; rerunning with that session paused passed. Concurrent-load reliability still needs rehearsal.
- Inspected the expanded rack in the running app, changed its mix control and enabled both effects on the Scarlett Solo at 64 samples / 48 kHz. The app reached On Air with zero reported input drops. Restored Stadium Rock (PC 2), its original levels and both effects off, leaving the rack expanded and audio running. The saved preset file remains byte-for-byte identical to the backup. This UI check did not evaluate sound quality.

Live guitar listening, level balancing and a full website-driven rehearsal remain necessary; automated tests do not establish that this sounds like Asato.

## Simplified amp controls, 2026-10-16

Removed the Spring dial from the amp panel. Input, Gate and Output share the control strip; reverb controls are available in the Space effects panel. This is a panel-only change: existing saved spring values and audio processing are retained to preserve preset compatibility and sound.

## Effects rack design, 2026-10-16

Echo and Space now appear as stacked 19-inch-style units below the amp, with mounting ears, slotted screws, inset coloured screens and pixel rotary knobs. Effects Rack opens expanded and can still be collapsed. Echo keeps its blue accent and Space its purple accent, using the existing fonts and palette.

Drag knobs vertically or focus them and use arrow keys. Effects knobs adjust in whole units; amp knobs retain their half-unit steps. The Echo display shows character, stereo mode, actual delay time, timing division, stored tempo and feedback. Space shows the reverb type, length, pre-delay and width. Every knob also has a numeric readout. Power, tap, timing selectors and the shared ducking control retain their existing functions; sound processing and preset storage are unchanged.

Validation: signed release build and display checks passed, including a 460-point rack render. Inspected the running widescreen app and verified that dragging the delay knob and using arrow keys update its screen immediately; checked reverb length updates too. Restored the controls after testing, including the existing unsaved −66.5 dB amp gate adjustment.

## Rig-first widescreen layout, 2026-10-16

The MIDI column now uses 28% of the available panel width, bounded to 300–360 points; the rig takes the rest. The voxel stage spans the column above a compact live-note count/status strip and one row of six permanent note slots. The monitor reserves 340 points in every note state; note gate/confidence controls stack vertically below it. Live readings still update independently of the rig; detection and outgoing MIDI are unchanged.

Preset selection and a quick Save button stay above the rig's scrolling gear. Mute remains in its fixed header; rig on/off sits beside Start/Stop and Refresh Devices in the bottom transport. The capture selector sits on the amp itself. Wide panels place the amp grille beside its knobs and rack screens beside their knobs; smaller windows fall back to the stacked arrangement. Model-folder and MIDI-mapping settings remain below the effects. The shorter app header and single-row transport give more height to the gear while keeping Stop available.

Display checks cover stable note geometry at 296/330/360 points, window bounds at 1040×600, 1280×720 and 1600×900, and narrow/wide gear renders. Full-window ImageRenderer exports do not draw native scroll content; the separate gear renders and live app inspection cover those areas.

Validation: signed build and display checks passed. Reviewed narrow/wide controls and the expanded six-note stage render, including sharp-note labels. In the running widescreen app the amp and both racks are visible together, with preset/Save and Mute above them and Start/Stop, rig on/off and Refresh Devices below. Restarted audio on the existing Scarlett route, confirmed On Air with zero input drops, and restored the unsaved −66.5 dB gate setting. No preset files were saved during this layout work.
