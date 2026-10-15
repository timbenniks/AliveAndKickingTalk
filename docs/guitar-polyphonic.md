# Experimental polyphonic guitar input

For MG3 evidence, local analysis artifacts and a future bug-investigation path,
see the [guitar research handoff](guitar-research-handoff.md).

In Rig settings or `/config`, set **Neck follows → Guitar**, select a clean DI input,
then choose **Polyphonic notes · experimental** under Guitar detection. No MIDI
converter, plugin, model download or additional dependency is needed. Spectrum
remains the default. The neck has two sources: Track and Guitar. MIDI is
reserved for amp program changes; guitar MIDI input and MIDI lane mapping
have been removed. Saved MIDI neck-source preferences fall back to Track.

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
six low-to-high pitch ranges starting at E2, A2, D3, G3, B3 and E4. These ranges cannot tell
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
`tests/stage-audio.mjs` exercises the real browser audio engine and six-lane events
at 30, 60, 120 and 144 Hz, mode changes and the analysis-rate cap.

Dense octave fixtures deliberately have measured tolerances rather than a
claim of perfect transcription. In the initial synthetic tests, A minor gives
5/5 correct pitches plus one extra; G major gives 5/6 plus one extra; drop D
gives 4–5/6 plus one or two extras. Octave-related partials can reinforce or
cancel, so generic magnitude templates can miss a note or substitute its
octave. Distortion, pickup-specific timbres, sympathetic ringing, bends,
unisons and low notes near adjacent semitones remain difficult. A noise gate
does not solve these ambiguities. Tim's live tests have been encouraging, but
there is no annotated real-guitar evaluation set or measured accuracy/latency
comparison. The synthetic tests are regression coverage, not an MG3-quality
claim. Rehearse with the same clean input before choosing this for a live talk.

## Guitar notes panel

Selecting Polyphonic notes shows the **Guitar notes** panel at the lower left
of the live/practise stage, above the player. All currently recognized note
names appear together, including chords; the input status appears below.
It stays visible with Rig closed. Close with × and restore it with **Show
notes** in Rig or `/config`. Visibility is saved in this browser between songs.
The panel is a normal interface feature and only appears for polyphonic guitar
input; Spectrum does not estimate note pitches.

Signal level, gate status and processing duration remain in Rig for tuning the
detector. The panel reuses the existing throttled readout and adds no analysis
work or animation loop.

## Quiet-input correction

The initial gate was mistakenly also used as the floor for individual FFT
bins, harmonic eligibility and fitted note amplitudes. These values are lower
than overall guitar RMS, so an input could be audible yet need a hard strum to
trigger. The gate now opens from the complete analysis band's RMS estimate
(window-power corrected); recognition uses signal-relative thresholds and a
broadband noise estimate. Existing gate settings remain saved. Rig shows **Signal … dB** and whether it is below the gate. If the signal is
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
