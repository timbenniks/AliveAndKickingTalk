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
