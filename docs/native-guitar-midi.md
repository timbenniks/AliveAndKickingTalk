# Standalone guitar-to-MIDI experiment

The standalone app was retired on 2026-10-16. Use [Alive Rig Preview](alive-rig-preview.md), built with `bash native/GuitarMIDI/build.sh`; **Turn rig off** provides the notes-only Neural DSP fallback. The material below records the original app's implementation and validation. Its old build/launch commands are historical; the known-good app and source are backed up as described in the current guide.

Built on branch `turbo-tim/native-guitar-midi`, based on the browser detector branch. This adds a macOS companion and a MIDI note input to the website. The existing browser detector remains selectable under **Guitar**. The native route is **Guitar MIDI**.

## What it uses

This version actually runs **Spotify Basic Pitch's pretrained ML weights**, using Apple's Core ML runtime. It does not use MIDI Guitar 3 weights, and we did not train a model. The earlier browser detector is our independent spectral/harmonic algorithm; these are separate experiments.

The model package is bundled in `native/GuitarMIDI/Models/`, pinned to upstream revision `fa5997af0a8210982619003269994a1be25eddf3`. See that directory's README for file hashes and provenance. Its upstream repository uses **Apache-2.0**, correcting the linked chat's MIT claim. A copy of the license is included in the built app. No Python, server, account, model download or internet connection is needed at runtime.

The linked chat was useful, but its models solve different problems. [Basic Pitch](https://github.com/spotify/basic-pitch) provides a small polyphonic model that we can run locally. [NeuralNote v2](https://github.com/DamRsn/NeuralNote) now documents a record-then-transcribe MuScriptor workflow; that does not establish immediate live MIDI suitability. Mono detectors would not meet the requested chords-and-riffs scope.

## Signal route

```text
Guitar → clean interface input → Alive Guitar MIDI (Core ML)
                              → virtual MIDI source “Alive Guitar MIDI”
                              → browser MIDI permission → stage lanes + note display

Backing track → existing song analysis → lights, camera and song timeline
Amp program changes → existing separate MIDI output
```

The native app creates its own CoreMIDI virtual source. No IAC setup or local WebSocket service is required. The website uses the [Web MIDI API](https://www.w3.org/TR/webmidi/) directly, requesting no SysEx access. Use Chrome or Edge on HTTPS, or localhost during development; the website reports unsupported browsers and denied permission. The MIDI input connection never disables the existing amp output connection.

## Build and use

Requires macOS 14 or later and Xcode command-line tools. The script builds for the current Mac's architecture; this checkout was tested on Apple Silicon. The local app is ad-hoc signed, not notarized for distribution.

From the repository root:

```sh
bash native/GuitarMIDI/build.sh
open 'native/GuitarMIDI/dist/Alive Guitar MIDI.app'
```

1. Connect the interface and choose its clean DI input in **Alive Guitar MIDI**. Select the channel carrying the guitar, not a stereo sum. Route amp monitoring separately as usual.
2. Click **Start listening** and allow microphone access. The app does not play captured audio through speakers.
3. In the website's Rig controls choose **Neck follows → Guitar MIDI**. Allow MIDI access, then select **Alive Guitar MIDI**. That port exists while the companion is listening.
4. Enable the note display if hidden. Chords produce multiple notes; highway lanes still represent low-to-high pitch ranges, not identified physical strings.
5. Start with **Balanced + Automatic**. Stop before adjusting timing, acceleration, gate/confidence or input. Lower the gate for quiet notes. Raise confidence to reduce extra notes, lower it for missed notes. These controls trade recall against false positives.

Stopping, closing the companion window, rebuilding capture after an audio configuration change, losing audio callbacks for two seconds, or a reported processing failure releases its notes. Harmless configuration notifications leave healthy capture running; a stopped or reconfigured engine now attempts to reconnect automatically as described below. A dropped capture buffer resets the decoder before processing resumes. The website clears held notes on port disconnection, switching sources, and channel all-notes-off/all-sound-off messages. Reconnect by port name is supported.

The website also accepts other MIDI note sources, including an existing guitar-to-MIDI app, so we can compare engines with the same stage experience. It listens to notes D2–E6 (MIDI 38–88), on all channels, tracking channel and pitch separately. Velocity-zero note-on is note-off. Repeated note-ons generate fresh attacks. It ignores program changes, pitch bend, sustain pedals and out-of-range pitches. The incoming queue is bounded to 64 visual attacks. The backing track may be paused while guitar notes move along the highway.

## Streaming adapter and timing

The unchanged model takes `[1, 43844, 1]` mono samples at 22,050 Hz and returns 172 frames of 88 note probabilities, 88 onset probabilities and 264 contour values. Its source is designed for file transcription, so this is our experimental streaming adaptation, not an upstream real-time feature.

We retain a rolling 43,844-sample window, initially padded with silence. The default Balanced preset runs inference every 1,024 new samples (~46.4 ms), emitting frames 160–163 and retaining eight frames of right-hand context (~92.9 ms). Timing is adjustable in whole model frames (256 samples, ~11.6 ms). Each prediction contributes exactly as many frames as the window advances, so successive predictions neither replay nor skip decoded audio. Settings are fixed for each listening session; stop before changing them.

The Accurate preset preserves the original frames 153–156 and 15-frame context (~174.1 ms), which followed the default half-overlap size in upstream file inference. That does not guarantee full receptive-field coverage or equivalent offline accuracy. Predictions from adjacent overlapping windows can disagree. Automatic acceleration permits Core ML to choose among supported processors; CPU only is available for comparison or troubleshooting. We do not claim that a particular physical accelerator is selected.

Our live decoder uses onset probability, two frames of strong note evidence as an alternate start, three weak frames for release, and a minimum 10-frame interval between onset retriggers. It supports multiple active notes. Gate decisions are aligned to the decoded audio frames. Input audio is converted to mono/22,050 Hz using AVAudioConverter. Inference runs on a serial worker, with bounded capture work instead of an ever-growing queue. A visible dropped-buffer counter exposes overruns. The audio tap still allocates/copies a mono buffer; this is a prototype, not a hard-real-time audio driver.

MIDI output uses channel 1 and fixed velocity 96. Model confidence is not musical velocity. Pitch bends, MPE, physical-string assignment and calibrated dynamics are not implemented. The UI's **inference ms** is model prediction duration, not input-to-MIDI latency. The existing website Visual offset changes the song clock; it cannot erase this detector's delay.

## Measurements and checks, 2026-10-16

Run the native checks with:

```sh
'native/GuitarMIDI/dist/Alive Guitar MIDI.app/Contents/MacOS/AliveGuitarMIDI' --self-test
```

This exercises the actual bundled model, synthetic harmonic riffs/chords, our note lifecycle, and a real CoreMIDI source-to-input loopback. It does not open a microphone. The model tests assert that expected pitches occur and that notes release after silence; they deliberately report extra pitches rather than claiming perfect accuracy.

With the original 15-frame context, 46.4 ms interval and CPU-only settings, one optimized run on this Mac measured **7.39 ms median / 8.56 ms p95 inference** across 112 windows. A second run with the browser stage open measured **9.39 ms median / 10.46 ms p95**, with the same note results and audio-time delays. First expected notes appeared as follows:

| Input | Expected pitches | Emitted pitches during phrase | First expected note delay |
| --- | --- | --- | --- |
| Single A2 | 45 | 45, **69 extra** | 203 ms |
| Single E3 | 52 | 52 | 186 ms |
| A2–E3–A3 power chord | 45, 52, 57 | 45, 52, 57, **81 extra** | 168 ms |
| Open E major | 40, 47, 52, 56, 59, 64 | all six, no extras | 168 ms |

These delays are computed from processed audio sample times, excluding CPU execution, capture/converter buffering, OS scheduling, MIDI delivery and browser rendering. The original UI showed an approximate **200–300 ms** live budget for those settings. The adjustable version removes that fixed estimate; actual guitar-to-screen latency has not been measured. The test signals have controlled envelopes and eight harmonic partials; they do not reproduce pickups, fret noise, palm muting, clipping, detuning or realistic overlapping decay.

Website validation covers chords, same-note retriggers, channel-specific release, velocity-zero release, panic, hotplug/reconnect, permission races, bounded queues, inactive sources and held-note visuals while the track is paused. The existing amp program-change regression still passes. `npm run build`, `npm run typecheck`, `npm run lint`, and `npm test` pass.

A real CoreMIDI source was also connected to Chrome on localhost:3107: the website displayed E2, B2, E3, G♯3, B3 and E4 from synthetic MIDI messages while the backing track remained paused. Note-off cleared the display, and removing the source cleared the connection. The amp output remained connected. This checks transport and display, separately from audio recognition.

The native app launches and lists the available input devices. No guitar interface was connected during this work, so live DI capture/accuracy and simultaneous use with the amp remain hardware acceptance checks. No claim of MIDI Guitar 3 parity or improved accuracy over our browser detector is supported by these four synthetic phrases.

## What this experiment tells us

The native-to-browser transport works and gives us a clean comparison point for other engines. Moving inference off the browser is straightforward; getting reliable polyphonic notes quickly is still the difficult part. Basic Pitch's tiny model runs cheaply, but its context and occasional octave errors make this version better suited to evaluating detected notes and delayed visual feedback than playing a responsive synth.

The next decisive evidence is a shared clean DI recording set: fast riffs, repeated strums, open/barre chords, quiet octave voices, palm mutes and silence. Compare the browser detector, this companion and MIDI Guitar 3 on identical recordings with annotated notes. Measure missed/extra notes, onset error and end-to-end delay separately. Do not replace either detector based only on the current synthetic tests. A genuinely faster ML path would need a causal/short-context model, training/fine-tuning with an appropriate dataset, or validated access to an existing live engine; simply moving the same weights to native does not remove future-context requirements.

## Alive and Kicking visual design

The companion now uses the website's night-purple/tolex surfaces, cream text, gold actions and six fret colors. The same Jersey 10, Silkscreen and Barlow Semi Condensed fonts are bundled locally with their licenses. Buttons have stepped pixel frames and hard shadows, matching the site's stompbox controls.

A miniature native canvas adapts the site's Benniks amp stacks, woven speaker grilles, lighting truss and perspective fretboard. Detected pitches light their corresponding pitch-range pads and appear in colored note tiles. The input meter uses discrete blocks, while status, inference time and dropped buffers remain visible. The art is static except for updates from actual notes; it adds no animation timer or 3D engine. The audio model, thresholds, MIDI messages and capture path are unchanged.

Validation: rebuilt and verified the signed app bundle, inspected the native window for clipping and readable controls, and reran the existing model/decoder/CoreMIDI self-test successfully. Only native Swift, bundled font resources, the native build script and documentation changed in this design pass.

## Comparison with Fretwire, 2026-10-16

Inspected `/Users/tim.benniks/Websites/fretwire`, commit `af9fd09`, including its current source files. The table and comparison results below describe Alive before the adjustable-controls update. Its Xcode project/workspace had local changes; these were not modified. This comparison did not start audio capture or change either detector's runtime settings.

**The model is identical.** SHA-256 hashes match for both the Core ML model definition (`af7bf7d4…`) and the weights (`691a6b63…`). Neither app uses MG3 weights. Differences come from capture, streaming context, note decoding and MIDI features.

| Area | Alive Guitar MIDI | Fretwire |
| --- | --- | --- |
| Capture | AVAudioEngine tap, requests 1,024-frame buffers | AUHAL, requests 128-frame device buffers; UI offers 64/128/256 |
| Queue | One pending capture buffer; drops reset decoder and increment a counter | Lock-protected 131,072-sample ring; overflow drops new samples without an exposed discontinuity reset |
| Resampling | AVAudioConverter | Two biquad low-pass stages plus linear interpolation |
| Lookahead | Fixed 15 frames (~174 ms) | Default 8 (~93 ms); UI allows 2–20 |
| Net interval | Fixed 1,024 samples (~46.4 ms) | Adjustable 12–93 ms; default UI 46 ms |
| Compute | Core ML CPU-only | Core ML `.all`, permits acceleration |
| Notes | D2–E6, two-frame soft onset, three-frame release | Adjustable range, four-frame soft onset, adjustable release, six-voice default limit, octave suppression |
| MIDI | Channel 1, fixed velocity 96 | Plain MIDI or MPE, level-derived velocity, contour-derived bend and pressure |
| UI | Website design, note tiles, six pitch-range pads | Keyboard, guessed string/fret positions, detailed note table, MIDI monitor |
| Failure handling | Audio configuration observer, no-audio watchdog, stop/release on inference failure | No equivalent watchdog/configuration observer found; inference exceptions report an error while the loop continues |
| Automated checks found | Model, decoder, real CoreMIDI loopback, website lifecycle/integration tests | No test files/target found in the inspected source tree |

The buffer request in Fretwire changes a device property; its return value is ignored and the app's latency estimate uses the requested value, not a verified actual buffer size. A small requested buffer alone does not establish actual end-to-end latency. Its ring also permits a backlog under worker stalls. Our drop-and-reset approach trades continuity for bounded work. Neither capture strategy was benchmarked against a real interface here.

### Controlled model/decoder comparison

A temporary Swift harness fed both engines the same 22,050 Hz synthetic audio in 1,024-sample chunks. It used four phrases with the same harmonic synthesis as our existing self-test, shifted one second later to get past Fretwire's startup warm-up. Fretwire's copied `PitchEngine` was changed only to accept the compiled model path rather than locate an app bundle; its tracker was used directly, with the app's default MPE contour reach of 2,400 cents. The identical bundled model was used for both. The apps' capture, resampling and MIDI delivery were bypassed. Final measurements ran sequentially to avoid simultaneous inference contention.

| Engine/configuration | First correct note delay across four phrases | Median inference |
| --- | --- | --- |
| Alive, original defaults | 178–207 ms | 7.48 ms |
| Fretwire, 8-frame default | 86–114 ms | 2.76 ms |
| Fretwire, 4-frame context | 39–68 ms | 2.72 ms |
| Fretwire, 15-frame context | 143–190 ms | 2.73 ms |

Delay here is processed audio time, excluding inference runtime and all hardware/browser overhead. It is the first correct note, not the time until a complete correct chord. This is a tiny synthetic comparison, not a guitar accuracy benchmark. Core ML `.all` ran faster on this Mac than our CPU-only baseline; the prior comment claiming CPU-only was measured faster has been corrected. The selected physical accelerator was not profiled.

At default settings, both engines found all expected pitches across these phrases. Both emitted an extra A4 during A2 and A5 during A2–E3–A3. Fretwire also emitted an extra E5 during E3. At four frames, Fretwire emitted a wrong F2 alongside A2 and generated seven note-ons for the six-note E-major phrase. Its octave filter does not guarantee elimination of octave errors, and the speed improvement is not evidence of better accuracy.

### Reproduced edge cases to resolve before copying its tracker

- **Startup burst:** Fretwire waits for half its model window before its first inference. In the harness that was 1.022 seconds. At the eight-frame setting it then emitted 81 historical analysis frames, starting at audio time 0.0027 seconds, in one batch. Its app sends the resulting MIDI events immediately. Notes played immediately after Start can therefore be emitted late and bunched together. The steady-state latency estimate does not include this startup behavior. See `Fretwire/PitchEngine.swift:127` and `:149`.
- **Repeated attacks from one broad onset:** feeding 25 consecutive frames with fixed note activation 0.9 and onset activation 0.8 produced four note-ons for one pitch. The retrigger checks elapsed frames and high onset probability, but not a new rising onset. Our decoder requires the onset to fall and rise again. See `Fretwire/NoteTracker.swift:95`.
- **MPE bend cross-talk:** two stationary, exactly in-tune contour peaks at A2 and E3, with Fretwire's default MPE contour reach, produced approximately +347 and −347 cents of bend after eight frames. The broad centroid pools both voices and pulls them toward one another. This is a deterministic decoder test with supplied activations, not a measurement on recorded guitar. Independent voice/contour association is needed before treating these bends as accurate. See `Fretwire/NoteTracker.swift:182` and `Fretwire/AppModel.swift:192` (the `maxBendCents` assignment).

### Implication for our experience

Fretwire already implements the adjustable context and net interval discussed in this chat. Those are concrete improvements worth bringing into our companion, together with a tested Core ML compute option. Its AUHAL capture path is worth measuring on the real interface. Retain our tested note lifecycle and failure handling while comparing both decoders on the same DI recordings; do not transplant the extra MIDI features without validating them.

The website can already select **Fretwire** in **Rig → Guitar MIDI → Note input**. Its note-on/off messages work with our all-channel listener. The website currently ignores pitch bend and pressure, so those features do not improve our displayed pitch accuracy. Notes outside D2–E6 are also filtered by the website, even though Fretwire's native range is wider. Plain MIDI is sufficient for the stage comparison; string/fret positions in Fretwire are guesses, not measured physical-string identity.


## Adjustable response controls, 2026-10-16

Version 0.2.0 adds the controls informed by the Fretwire comparison, retaining our capture queue, onset-edge retriggering, release handling and unchanged pretrained weights. The voxel interface now has a Response panel; it scrolls on smaller screens.

| Preset | Lookahead | Analysis interval | Intended comparison |
| --- | --- | --- | --- |
| Fast | 4 frames / 46.4 ms | 2 frames / 23.2 ms | Earlier decisions with less future context |
| Balanced (default) | 8 frames / 92.9 ms | 4 frames / 46.4 ms | Starting point for the guitar test |
| Accurate | 15 frames / 174.1 ms | 4 frames / 46.4 ms | Original context; compare missed and extra notes |

“Accurate” names the longer-context option, not a proven accuracy ranking. The synthetic Fast result below happens to have fewer extras; real DI recordings are needed to judge these presets.

The sliders allow **2–20 lookahead frames (23.2–232.2 ms)** and **1–8 interval frames (11.6–92.9 ms)**. Moving a slider labels the combination Custom unless it matches a preset. Shorter intervals run the model more often; they do not reduce the hardware capture buffer. Presets change timing only, preserving gate, confidence and acceleration. Settings remain for subsequent starts in the current app session and reset on app relaunch.

**Automatic** allows all Core ML compute units and is the default. **CPU only** restores the previous compute policy. Changing this option reloads the model on the next Start. A model load or inference failure still stops capture and releases notes; there is no silent switch to another compute mode. All settings are disabled while starting/listening. Every new start resets the displayed inference and dropped-buffer counters.

### Checks after the update

The optimized native build and self-test passed. Tests cover all 152 supported timing combinations for consecutive frame coverage, actual inference at custom boundary settings, split capture chunks, multiple predictions per append, pending remainders, reset/release, broad onset rejection, all presets, CPU fallback and actual CoreMIDI delivery. Native UI checks verified preset values, custom sliders, acceleration selection and layout. No microphone was opened for these checks.

One sequential run of the four synthetic phrases measured:

| Configuration | First expected note delay | Median / p95 prediction time | Extra pitches |
| --- | --- | --- | --- |
| Fast + Automatic | 46–64 ms | 2.66 / 3.14 ms | None in these four phrases |
| Balanced + Automatic | 93–122 ms | 2.67 / 3.28 ms | A4 during A2; A5 during power chord |
| Accurate + Automatic | 168–203 ms | 3.02 / 3.50 ms | Same extras as Balanced |
| Accurate + CPU only | 168–203 ms | 7.88 / 8.12 ms | Same extras as Balanced |

All expected pitches appeared and all held notes released in every configuration. Delay is measured on the processed audio timeline, excluding capture, conversion, processing, MIDI and screen overhead; it is the first expected note, not the completion of a chord. These four generated signals are regression checks, not a real-guitar accuracy benchmark.

### Real-guitar test

1. Select the clean interface channel, keep gate at −60 dB and confidence at 0.50 initially, and start with **Balanced + Automatic**. In the website select **Guitar MIDI → Alive Guitar MIDI**.
2. Play single-note riffs, repeated strums, open/barre chords, quiet notes and muted stops. Watch for missed notes, extra octave notes, delayed attacks and lingering notes.
3. Stop, choose **Fast**, and repeat the same material at the same input level. Compare feel and note errors separately. Try Accurate if more context helps a troublesome phrase.
4. If the dropped-buffer counter increases, try a longer analysis interval. Compare CPU only if Automatic fails or behaves poorly. Record the preset/custom timing, compute option, gate/confidence and input device with each result.

The website's existing MIDI listener needs no change for these controls. Audio monitoring stays with the interface/amp; only detected notes travel to the website.

## Scarlett channel selection fix, 2026-10-16

A hardware test reproduced the reported “selected input/channel is unavailable” error with Scarlett Solo USB Channel 2. Before selecting the device, AVAudioEngine had a mono 32 kHz input/output format. Selecting Scarlett updated the input hardware format to two channels at 48 kHz, but its output format remained mono at 32 kHz. The capture code incorrectly used that stale output format to validate Channel 2 and configure the tap.

Capture now reads `inputNode.inputFormat(forBus: 0)` after selecting the device and installs the tap with that format. This follows Apple's [input-node hardware-format guidance](https://developer.apple.com/documentation/AVFAudio/AVAudioEngine/inputNode). It does not change the macOS default input or the interface sample rate. A missing audio unit now fails explicitly; unavailable-channel errors report the requested channel and actual hardware format. A tap-format guard stops capture if channels or sample rate change before the configuration notification is handled.

An optional hardware regression check uses the production capture, conversion and model path for three seconds, then releases notes and stops. It requires microphone permission already granted to the app and does not save audio:

```sh
'native/GuitarMIDI/dist/Alive Guitar MIDI.app/Contents/MacOS/AliveGuitarMIDI' --input-test 'Scarlett Solo USB' 2
```

Both Scarlett channels passed independently: each delivered 29 reports and 63,488 converted samples to the detector. Channel 2's highest buffer RMS was approximately −84 dBFS during this quiet check; Channel 1 was approximately −100 dBFS. These checks confirm audio delivery, not guitar recognition or correctness of the physical wiring. Nonexistent Channel 3 failed cleanly with the detailed error. The existing model, timing, note-release and CoreMIDI self-tests also passed after the fix.

The relaunched UI also reached **ON AIR** with Scarlett Channel 2 selected, showed an input level around −37 dBFS and emitted a detected note. Its dropped-buffer counter reached 18 during the live observation, so capture continuity under load still needs follow-up; successful device selection does not establish dropout-free operation or correct recognition of the played notes.


## Playback-route recovery, 2026-10-16

Using Scarlett Solo USB for macOS playback exposed a second issue. The original handler treated every `AVAudioEngineConfigurationChange` notification as a fatal error. With Scarlett as the default output and RØDE as the default input, a fresh engine explicitly capturing Scarlett Channel 2 emitted that notification while still running. Its input and tap formats were both stereo 48 kHz, and a diagnostic received 39 audio reports over four seconds. Stopping on that notification was unnecessary and caused the reported failure even when restarting manually.

The capture adapter now remembers the actual input device and tap format. On the main queue after a notification, it checks the engine's running state, device identity, and input/output formats. If these still match, listening continues. If the engine stopped or the route no longer matches, the app releases notes, drains the old capture, waits half a second for routing to settle, and builds a fresh engine with the same selected input/channel and detector settings. This follows Apple's [configuration-change lifecycle guidance](https://developer.apple.com/documentation/foundation/nsnotification/name-swift.struct/avaudioengineconfigurationchange), including avoiding engine teardown inside the internal notification callback.

Reconnection allows at most three attempts in ten seconds. Repeated notifications from an old capture are ignored using its generation token. Stop, window close and termination cancel pending reconnects. Manual Start resets the retry limit. A stopped engine discovered by the no-audio watchdog also attempts recovery; a running engine with no callbacks still stops with an error. Processing/MIDI errors and unexpected tap-buffer format changes remain explicit failures. The app never switches an explicitly selected Scarlett input to another device, changes the system playback preference, or silently falls back to a microphone. During a necessary rebuild the virtual MIDI source is recreated; the website's existing reconnect-by-name behavior handles that interruption.

Hardware validation with Scarlett still selected as macOS output:

```sh
'native/GuitarMIDI/dist/Alive Guitar MIDI.app/Contents/MacOS/AliveGuitarMIDI' --reconnect-test 'Scarlett Solo USB' 2
```

The test passed initial live capture with zero reconnect attempts, a harmless notification without restarting, three forced stopped-engine/notification cycles with resumed audio, duplicate-notification suppression, retained Channel 2 selection, the retry limit, manual restart after that limit, and cancellation when Stop is pressed during the reconnect delay. These tests stop the real capture engine and inject its documented notification; they do not change the user's playback device. They confirm the recovery path, not every possible physical device-switch sequence.

The standalone three-second Channel 2 capture check and full model/MIDI self-test also passed. The rebuilt GUI remained **ON AIR** with Scarlett Channel 2 selected and Scarlett still the system playback output; the observed dropped-buffer count was zero at that check. This is a short capture check, not a long-duration playback or note-accuracy benchmark.


## Notes on the fretboard and expressive data, 2026-10-16

The website now displays pitch names directly above voxel gems at the six fretboard bases. Attacks spring upward, held notes stay raised with a lit base, and release eases back over 160 ms. A short note received and released between rendered frames still produces a brief 180 ms readout before that fade. A re-strike restarts the launch. Names sharing one pitch-range lane stack in a compact column; identical pitches on multiple MIDI channels merge visually but remain held until all corresponding channel voices release.

Sustain trails grow from each held note's received onset, capped at 3.5 scene units for readability. This is detected note duration, not measured acoustic decay or sustain-pedal data. The named gems work over a paused backing track. Source changes, panic and disconnection clear the visual state. Reduced motion uses static raised notes; the visibility preference now controls fretboard names rather than a side panel. A screen-reader readout and Rig diagnostics remain.

| Musical property | What the current native route provides | Website behavior |
| --- | --- | --- |
| Pitch / chords | Integer MIDI notes D2–E6, independent note-on/off | Named gems; simultaneous pitches stay visible |
| Attack and sustain duration | Note-on, re-strike and note-off timestamps | Launch, held pose, growing trail, release |
| Pick strength | Every native note currently has velocity 96 | Gem sizing accepts actual incoming velocity, but this companion produces equal strength |
| Ongoing per-note loudness / decay | No per-note amplitude or pressure messages; native input meter is overall signal RMS | No claimed per-note loudness envelope |
| String bend / vibrato | No pitch-bend messages; fine-pitch model contours are not decoded into reliable voice bends | No invented bend animation; chromatic note changes remain separate detected notes |
| Physical string / fret | Not identified from the mixed guitar cable | Lane remains a pitch range, not a fingering diagram |

The browser-only polyphonic experiment has estimated spectral strengths, which already drive its lanes; those are also not calibrated loudness measurements. The working native detector and its Fast settings were left unchanged in this visual pass.

### Where expression could go next

Raw audio contains overall amplitude, and the model also returns 264 fine-pitch contour probabilities. Neither is automatically a reliable per-note performance measurement. An overall RMS value must not be assigned independently to all chord voices, and activation probability must not be labeled loudness. A bend crossing a semitone must retain voice identity rather than become a new unrelated note.

The next native experiment should measure onset-aligned spectral energy for velocity and a continuing per-voice envelope, then associate narrow contour peaks with tracked voices for bend estimates. Test a stationary chord alongside one bent string, slow bends, vibrato, slides and overlapping note decay. The prior Fretwire contour test showed why pooling a broad band pulls neighboring voices out of tune. Independent bends would also require separate MIDI voice channels/MPE (the current channel-1 stream cannot bend one note without bending its chord), plus browser parsing of bend range and pressure. When validated, gem size/glow could follow amplitude and a sideways offset/curved trail could follow bend cents. These are follow-up experiments, not implemented measurements.

Validation for the current website change: native CoreMIDI test source into Chrome, six-note E-major names, three notes sharing one lane, varying transmitted velocities, release, label visibility, and reduced-motion display. Automated checks cover held duration, re-strikes, unison merging, polyphonic routing, disconnect/source cleanup and static reduced-motion pose. Build, typecheck, lint and the full test suite pass.

## Dock icon, 2026-10-16

The companion now has a gold pixel guitar icon on a purple rounded tile, with all six fret colors. The bundled ICNS provides standard and Retina sizes and is declared in the generated Info.plist, so subsequent builds keep the icon. Original editable AppKit artwork and regeneration commands live under `native/GuitarMIDI/Artwork/` and `Resources/README.md`. This changes only the app's appearance in macOS; audio and MIDI behavior are unchanged.

macOS retained the generic Dock icon after the first bundle update. The main window now explicitly loads the bundled ICNS into `NSApplication.applicationIconImage` when it appears, refreshing the running app's icon without restarting the Dock. The bundle metadata also names the full `AppIcon.icns` filename.

## Development stylesheet recovery, 2026-10-16

After removing the visible guitar-notes panel, an open development session retained a link to `StageGuitarNotes.vue`'s old scoped style block. The component no longer contained any style block. The reported CSS compiler error included the component's `<script setup>` source, and the running server's page HTML still referenced style index 0. This was a stale development stylesheet reference, not a note-analysis or song-data error.

The screen-reader readout now owns a scoped `.note-announcement` rule for its visually hidden presentation. This restores the existing style URL while keeping note names on the fretboard and the accessible status text in the page. The exact formerly failing scoped CSS URL returns HTTP 200 with CSS only. The open Enter Sandman page at 02:32 / 02:32 renders without the compile-error overlay after hot reload.

## Solo burst visuals, 2026-10-16

The website now reacts to fast runs from Guitar MIDI and the browser's polyphonic guitar input. A `SOLO BURST` badge shows the detected attack rate and eight energy blocks. The fretboard gains gold stepped runway lights, brighter and longer trails, slightly larger travelling gems and extra pixel sparks. Existing note names remain readable. This uses received note-on timing; it does not run more audio analysis or change the native app.

A bounded attack tracker groups voices arriving within 55 ms of the first attack. Groups containing different pitches are excluded as chords; duplicated same-pitch messages in that group count once. Six accepted attacks, at least 350 ms of history, at least five attacks per second and no gap longer than 280 ms build the effect. History spans at most 1.2 seconds and retains at most 24 attacks. Repeated picking on one pitch qualifies. This is a playful density estimate, not a judgment of accuracy or a classifier that understands musical solos; a very slowly rolled chord or detector errors can still affect it.

The level rises smoothly over about 120 ms and decays over about 550 ms after the run drops below the threshold. A 300 ms grace period tolerates small pauses. The effect works over a paused backing track. Source changes, detector restarts, MIDI panic/disconnect and teardown clear it immediately. The badge updates at most ten times per second; the 3D scene reads the level in its existing render loop and reuses the existing capped particle/trail pools. A background-tab gap cannot leave a persistent burst.

Reduced motion keeps a static badge and suppresses the extra runway lighting, gem enlargement, trails and sparks. The effect measures received attacks, so the displayed rate includes the detector/browser's scheduling behavior rather than claiming exact acoustic performance timing.

Validation: fast melodic runs at 30/60/144 Hz drawing rates; repeated picking; slow melody; rapid six-voice chord strums; silence and long background gaps; source reset; MIDI disconnect; and the paused-track MIDI integration. A real CoreMIDI test source into Chrome produced a 7–8 notes/sec burst with visible gold runway/trails, and the Rig's reduced-motion setting removed those embellishments. This is synthetic MIDI validation; the next real-guitar pass should tune the five-notes/sec threshold and chord grouping against actual solos.
