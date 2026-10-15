# Experimental polyphonic guitar input

In Rig settings or `/config`, choose **Guitar input**, select a clean DI input,
then choose **Polyphonic notes · experimental** under Guitar detection. No MIDI
converter, plugin, model download or additional dependency is needed. Spectrum
remains the default; the existing Guitar MIDI input still works with MG3.

Start with the gate at −65 dB. Raise it until idle noise no longer triggers,
and lower it if quiet notes disappear. Tune to A440, or use the tuning control
(−50 to +50 cents) for a consistently sharp/flat guitar. Both controls and the
selected mode persist between songs. Detected note names and the most recent
fit duration are visible in settings. The duration measures the fit only, not
FFT, input-interface latency or total note-to-gem latency.

The detector covers D2–E6, fits up to six simultaneous pitches, and uses the
same low-to-high pitch ranges as the MIDI Notes mode. These ranges cannot tell
which physical string was played. Multiple notes in one pitch range can
launch separate gems into that lane. Drop D is within the supported range;
lower tunings are not.

## Implementation

This is an original spectral-template detector, with no Jam Origin code,
weights or extracted assets. The browser provides a Blackman-window FFT. Each
candidate needs fundamental energy and two aligned higher spectral peaks.
A bounded sparse nonnegative fit compares 51 pitches, each with three generic
harmonic rolloffs, so notes compete to explain shared partials. Temporal
confirmation, release grace, a six-voice cap and a per-note retrigger interval
reduce flicker and repeated gems during sustain. Strong increases in fitted
note amplitude can retrigger a held note.

The fit runs at most 30 times per second, independently of display refresh.
The FFT size scales with sample rate (4096 at 44.1/48 kHz, 8192 at 88.2/96 kHz,
16384 at 176.4/192 kHz). At 48 kHz the analysis window spans about 85 ms;
confirmation needs two fits. This adds latency beyond the audio interface,
and fast articulation can merge. Guitar input is analysed without routing it
to speakers. Switching modes or devices resets tracking and queued guitar gems.

## Validation and limits

Run `node --experimental-strip-types tests/guitar-poly.mjs` for generated
waveform tests and a fit benchmark. The test synthesizes summed harmonics and
noise, then independently computes an FFT; it does not populate the detector's
templates directly. It covers single notes, bright/dark timbres, triads,
six-note E major, release/re-strum, gate and tuning at 44.1 and 48 kHz.
Additional checks cover every supported single pitch, stronger repeat attacks
and scaled windows for 96/192 kHz interfaces.
`tests/stage-audio.mjs` exercises the real input composable and six-lane events
at 30, 60, 120 and 144 Hz, mode changes and the analysis-rate cap.

Dense octave fixtures deliberately have measured tolerances rather than a
claim of perfect transcription. In the initial synthetic tests, A minor gives
5/5 correct pitches plus one extra; G major gives 5/6 plus one extra; drop D
gives 4–5/6 plus one or two extras. Octave-related partials can reinforce or
cancel, so generic magnitude templates can miss a note or substitute its
octave. Distortion, pickup-specific timbres, sympathetic ringing, bends,
unisons and low notes near adjacent semitones remain difficult. A noise gate
does not solve these ambiguities. Real guitar performance has not yet been
validated; the synthetic tests are regression coverage, not an MG3-quality
claim. Compare with Spectrum or MG3 using the same clean input before choosing
this for a live talk.
