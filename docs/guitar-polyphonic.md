# Experimental polyphonic guitar input

In Rig settings or `/config`, choose **Guitar input**, select a clean DI input,
then choose **Polyphonic notes · experimental** under Guitar detection. No MIDI
converter, plugin, model download or additional dependency is needed. Spectrum
remains the default; the existing Guitar MIDI input still works with MG3.

Start with the gate at −65 dB. Raise it until idle noise no longer triggers,
and lower it if quiet notes disappear. The gate compares the overall
spectrum-derived RMS signal level, rather than requiring each harmonic to
exceed the gate. Quiet harmonics stay available for pitch matching; matching
thresholds follow the signal and estimated broadband noise. Tune to A440, or use the tuning control
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

## Stage note debug window

Selecting Polyphonic notes shows a small note debug window at the lower left
of the live/practise stage, above the player. It shows all currently detected
note names, signal level, fit duration, gate setting and input status even with Rig closed.
The readout reuses the existing throttled diagnostics; it adds no detector
work or animation loop. Close it with ×, or use **Show note debug** in Rig
(or `/config`) to restore it. Visibility is saved in this browser between songs.
The window only appears for polyphonic guitar input.


## Quiet-input correction

The initial gate was mistakenly also used as the floor for individual FFT
bins, harmonic eligibility and fitted note amplitudes. These values are lower
than overall guitar RMS, so an input could be audible yet need a hard strum to
trigger. The gate now opens from the complete analysis band's RMS estimate
(window-power corrected); recognition uses signal-relative thresholds and a
broadband noise estimate. Existing gate settings remain saved. The note window
and Rig show **Signal … dB** and whether it is below the gate. If the signal is
above the gate but no notes appear, louder playing is not necessarily the fix:
that points to pitch matching, tuning or the input's timbre.

Regression checks now require quiet single notes, triads and six-note E major
at the default −65 dB gate, as well as a quiet note mixed with hiss. A hiss-only
fixture above the gate must produce no notes or gems. This fixes a reproduced
threshold problem; accuracy on the physical guitar still needs a live test.


## Octave filtering

**Rig → Guitar input → Octave filtering** now defaults to **Balanced**. When
all candidate notes belong to one pitch class (for example E3 and E4), a weaker
octave guess must have at least 65% of the strongest fitted note amplitude.
**Strong** raises this to 85%; **Off** restores the original fit. This is a
relative-strength preference, not a calibrated probability. It leaves mixed
pitch-class chords on the existing recognition path, and retains similarly
strong real octave pairs. Rejected octave notes are cleared immediately rather
than lingering through release grace. The selected setting persists between songs.

A quiet genuine octave voice can also be rejected: the same mono signal can
be consistent with one bright note or two octave notes. Turn filtering off if
you need those quieter octave voices. The filter does not fix every octave
error, especially in dense chords, or guarantee correct octave selection when
a harmonic is stronger than the played fundamental.

Waveform regressions cover single E notes with changing even-harmonic emphasis
at quiet input levels, balanced/strong/off settings, one gem per attack, a
clear real octave pair and the existing six-voice chord tests. The audio
integration test also checks the actual two-lane-to-one-lane routing and filter
changes. Physical guitar validation remains the next step.
