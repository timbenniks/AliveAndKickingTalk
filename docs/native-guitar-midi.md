# Standalone guitar-to-MIDI experiment

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
5. Stop before adjusting the native gate/confidence or input. Lower the gate for quiet notes. Raise confidence to reduce extra notes, lower it for missed notes. These controls trade recall against false positives.

Stopping, closing the companion window, changing its audio configuration, losing audio callbacks for two seconds, or a reported processing failure releases its notes. A dropped capture buffer resets the decoder before processing resumes. The website clears held notes on port disconnection, switching sources, and channel all-notes-off/all-sound-off messages. Reconnect by port name is supported.

The website also accepts other MIDI note sources, including an existing guitar-to-MIDI app, so we can compare engines with the same stage experience. It listens to notes D2–E6 (MIDI 38–88), on all channels, tracking channel and pitch separately. Velocity-zero note-on is note-off. Repeated note-ons generate fresh attacks. It ignores program changes, pitch bend, sustain pedals and out-of-range pitches. The incoming queue is bounded to 64 visual attacks. The backing track may be paused while guitar notes move along the highway.

## Streaming adapter and timing

The unchanged model takes `[1, 43844, 1]` mono samples at 22,050 Hz and returns 172 frames of 88 note probabilities, 88 onset probabilities and 264 contour values. Its source is designed for file transcription, so this is our experimental streaming adaptation, not an upstream real-time feature.

We retain a rolling 43,844-sample window, initially padded with silence, and run inference every 1,024 new samples (~46.4 ms). Each prediction contributes frames 153–156; the last 15 frames remain right-hand context (~174 ms). This follows the size of the default half-overlap in upstream file inference, but does not establish a guarantee about the model's complete receptive field or equivalent offline accuracy. Predictions from adjacent overlapping windows can disagree.

Our live decoder uses onset probability, two frames of strong note evidence as an alternate start, three weak frames for release, and a minimum 10-frame interval between onset retriggers. It supports multiple active notes. Gate decisions are aligned to the decoded audio frames. Input audio is converted to mono/22,050 Hz using AVAudioConverter. Inference runs on a serial worker, with bounded capture work instead of an ever-growing queue. A visible dropped-buffer counter exposes overruns. The audio tap still allocates/copies a mono buffer; this is a prototype, not a hard-real-time audio driver.

MIDI output uses channel 1 and fixed velocity 96. Model confidence is not musical velocity. Pitch bends, MPE, physical-string assignment and calibrated dynamics are not implemented. The UI's **inference ms** is CPU processing duration, not input-to-MIDI latency. The existing website Visual offset changes the song clock; it cannot erase this detector's delay.

## Measurements and checks, 2026-10-16

Run the native checks with:

```sh
'native/GuitarMIDI/dist/Alive Guitar MIDI.app/Contents/MacOS/AliveGuitarMIDI' --self-test
```

This exercises the actual bundled model, synthetic harmonic riffs/chords, our note lifecycle, and a real CoreMIDI source-to-input loopback. It does not open a microphone. The model tests assert that expected pitches occur and that notes release after silence; they deliberately report extra pitches rather than claiming perfect accuracy.

One optimized run on this Mac measured **7.39 ms median / 8.56 ms p95 inference** across 112 windows. A second run with the browser stage open measured **9.39 ms median / 10.46 ms p95**, with the same note results and audio-time delays. First expected notes appeared as follows:

| Input | Expected pitches | Emitted pitches during phrase | First expected note delay |
| --- | --- | --- | --- |
| Single A2 | 45 | 45, **69 extra** | 203 ms |
| Single E3 | 52 | 52 | 186 ms |
| A2–E3–A3 power chord | 45, 52, 57 | 45, 52, 57, **81 extra** | 168 ms |
| Open E major | 40, 47, 52, 56, 59, 64 | all six, no extras | 168 ms |

These delays are computed from processed audio sample times, excluding CPU execution, capture/converter buffering, OS scheduling, MIDI delivery and browser rendering. An approximate **200–300 ms** live budget is shown in the UI, but actual guitar-to-screen latency has not been measured. The test signals have controlled envelopes and eight harmonic partials; they do not reproduce pickups, fret noise, palm muting, clipping, detuning or realistic overlapping decay.

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

Inspected `/Users/tim.benniks/Websites/fretwire`, commit `af9fd09`, including its current source files. Its Xcode project/workspace had local changes; these were not modified. This comparison did not start audio capture or change either detector's runtime settings.

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
| Alive, current defaults | 178–207 ms | 7.48 ms |
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
