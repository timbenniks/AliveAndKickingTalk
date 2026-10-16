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
weights or extracted assets. The browser provides a Blackman-window FFT. The
research-informed version proposes continuous frequencies from local spectral
peaks divided by small harmonic numbers. It refines each proposal using its
supporting partials before fitting templates; notes no longer have to align
with a fixed semitone grid to be considered.

A proposal needs three closely aligned partials with relatively prime harmonic
orders. This allows a missing fundamental, while rejecting a lower octave
supported only by partials numbered 2, 4 and 6. Several timbres compete in a
bounded sparse nonnegative fit. When the first partial is unusually weak, the
fit can mix ordinary and missing-root templates. This is a small original
model, not a reconstruction of the MG3 engine. Near-grid refinements smaller
than five cents **and** 0.025 FFT bins snap to the calibrated grid to avoid
moving a whole template because of small peak shifts from overlapping notes.

The detector retains two-observation confirmation, an 80 ms release grace,
a six-voice cap, and a 130 ms per-note retrigger interval. Strong increases in
fitted note amplitude can retrigger a held note. Note names remain semitone
labels; continuous refinement does not add MIDI output or identify strings.

A separate timer targets **60 analyses per second**, independently of screen
drawing. Each analysis uses `AudioContext.currentTime` and skips repeated or
suspended audio time. There is no catch-up burst after a stall. The timer is
stopped/replaced on teardown, device changes and mode changes; queued events
are bounded even without a drawing consumer. It still runs on the main thread:
a blocked thread or browser timer throttling can delay analysis. This is not
an AudioWorklet or a guarantee of exact 60 Hz scheduling.

The FFT size scales with sample rate (4096 at 44.1/48 kHz, 8192 at 88.2/96 kHz,
16384 at 176.4/192 kHz). At 48 kHz the analysis window spans about 85 ms;
confirmation needs two fits. Increasing the fit cadence reduces one source
of delay, but does not shorten that window or prove end-to-end latency.
Guitar input is analysed without routing it to speakers. Switching modes or
devices resets tracking and queued guitar gems.

## Validation and limits

Run `node --experimental-strip-types tests/guitar-poly.mjs` for generated
waveform tests and a fit benchmark. The fixture synthesizes summed harmonics
with optional per-voice tuning, amplitude, phase and timbre, then independently
computes a Blackman FFT. It does not populate detector templates directly.

Existing coverage includes quiet input, bright/dark single notes, triads,
six-note E major, release/re-strum, gate and tuning, every supported single
pitch, stronger repeat attacks, and scaled windows for 96/192 kHz interfaces.
The new checks add 252 combinations of pitch, detuning and weak/absent roots
at 44.1/48 kHz; mixed bright chords; independently detuned voices; a quieter
real octave with filtering off; continuous vibrato; small high-note offsets;
and 100 changing broadband-noise windows. Sustains must produce one attack
per voice, rather than extra gems as the waveform phase changes.

`tests/stage-audio.mjs` runs the real audio engine against controlled devices
and clocks. It checks 60 Hz analysis with 30/60/120/144 Hz drawing, analysis
without any drawing, frozen/suspended audio, bounded events, mode changes,
device-request races and teardown. These checks do not open a microphone.

The research failures now have these measured synthetic outcomes:

| Input | Earlier detector | Current detector |
| --- | --- | --- |
| E3, fundamental absent | E4, B4 | E3 |
| E3, fundamental at 5% | E3, E4, B4 | E3 |
| E3, +25 cents, no calibration | No note | E3 |
| E3/G3 with strong even harmonics | E3, G3, E4, G4 | E3, G3 |
| Actual E3/E4 pair | E3, E4 | E3, E4 |

These rows use the inputs recorded in
[the deeper research](mg3-detector-edge.md#5-measured-weaknesses-in-our-existing-browser-detector).
The local six-note fit benchmark is around 0.6–0.9 ms per analysis; this excludes
FFT, audio interface, drawing and end-to-end latency and varies by machine.

For a broader comparison, run:

```sh
node --experimental-strip-types tests/guitar-evaluation.mjs 1b2dad3
```

Omit the Git reference to measure only the current detector. This diagnostic
does not replace the regression assertions or declare every input a pass.
It varies nine voicings, three starting phases, three harmonic falloffs and
four signal conditions: 324 combinations, four observations per case at 60 Hz.
Each condition contains 81 cases and 216 expected note instances. Counts below
describe the final observation using Balanced filtering.

| Condition | Exact cases, before → after | Missed notes, before → after | Extra notes, before → after |
| --- | ---: | ---: | ---: |
| Ordinary | 68 → 67 | 5 → 26 | 16 → 9 |
| Independently detuned | 9 → 63 | 165 → 24 | 34 → 6 |
| Weak fundamental | 0 → 31 | 91 → 39 | 260 → 90 |
| Strong even harmonics | 38 → 64 | 12 → 24 | 91 → 14 |

Across this sample, exact cases rise from 115/324 to 225/324 and false extra
notes fall from 401 to 119. **Ordinary chords regress in note recall**: the
stronger octave preference hides some real upper voices, even though it reduces
false notes. The largest gains are detuned and weak-root inputs. This mixture
is deliberately stressful and is not a representative real-guitar accuracy
estimate. It includes the phase/timbre combinations used to inspect the new
filter's tradeoffs; it is not an untouched validation set. Preserve the Off
setting when retaining quiet octave voices is more important than extra gems.

Dense octave fixtures deliberately have measured tolerances rather than a
claim of perfect transcription. At both 44.1 and 48 kHz with Balanced filtering,
A minor currently ends at 4/5 correct pitches with no extra; G major at 5/6
with one extra; drop D at 4/6 with no extra. The new filter favors fewer false
gems and can remove a quieter genuine chord voice. The older A-minor fixture
had more correct pitches but also an extra voice. This is a documented tradeoff,
not a claim that every chord is more accurate.

Arbitrary timbres, distortion, sympathetic ringing, unisons, fast bends across
note-label boundaries and low adjacent notes remain difficult. A missing
fundamental still needs enough visible upper partials in the analysis band;
a pure sine or a high note with only two remaining partials will not qualify.
Steady mono audio can be ambiguous between one bright note and a real octave
pair. A gate or more FFT windows cannot resolve every such ambiguity.

There is no annotated recording set from Tim's guitar or measured live
accuracy/latency comparison. Synthetic checks establish regressions, not
MG3-quality recognition. Rehearse with the actual clean DI input. An audio
worklet, additional windows or pickup-specific models should follow a measured
remaining failure; no new dependencies or native companion were added.

## Fretboard note names

The former Guitar notes side panel has been replaced by named voxel gems at the
fretboard bases, for both Polyphonic notes and Guitar MIDI. Each attack pops a
gem upward; the gem stays raised during the detected note and settles on release.
Notes sharing a pitch-range lane stack so chords keep their individual names.
Sustain trails grow while notes remain held, capped visually at 3.5 scene units.
These are pitch ranges, not identified physical strings or fret positions.

Rig / config has **Hide note names / Show note names**, using the existing saved
visibility preference. The gems still respond when their labels are hidden.
Reduced motion keeps static raised notes with no launch or sustain animation.
An off-screen live text readout retains screen-reader access; signal, gate and
processing diagnostics stay in Rig. Spectrum mode does not invent pitch labels.
The renderer reuses the stage loop, caching at most one gem and pixel label per
supported pitch. No new audio analysis or rendering loop was added.

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

**Rig → Guitar input → Octave filtering** defaults to **Balanced**. Filtering
now compares octave relatives within **each pitch class**, including mixed
chords. An unrelated G no longer disables protection against a phantom E4.
A candidate above its strongest octave relative needs at least 65% of that
relative's fitted amplitude. **Strong** raises this to 85%; **Off** removes
that preference. Lower supported notes are retained when a higher octave
is strongest, so a dominant upper voice does not automatically erase the bass.

This is a relative-strength preference, not a calibrated probability or proof
that a second string was played. Quiet real upper octaves can be rejected;
use Off when retaining those voices matters more than extra harmonic guesses.
Rejected upper octaves clear immediately instead of lingering through release
grace. Changing the setting resets tracking and queued gems; the setting
persists between songs.
