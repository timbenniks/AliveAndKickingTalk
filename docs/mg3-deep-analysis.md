# MIDI Guitar 3: deeper recognizer analysis

Investigation: 15 October 2026. Installed application: MIDI Guitar 3 3.0.74.
Read [the first research handoff](guitar-research-handoff.md) and
[our current detector](guitar-polyphonic.md) for the earlier work and product behavior.
This follow-up adds **two concrete analysis architectures**, harmonic scoring
formulas, spectral coverage tests, note-history layout, and reproducible tooling.

Later follow-up: [the standard guitar route and our next useful edge](mg3-detector-edge.md)
traces the normal MIDI Guitar 3 constructor to a separate DFT/Highway pipeline,
anchors the 3.2 core to Wind/Hex consumers, and clarifies the harmonic-chain
return value. Read it before treating the two routes below as an exhaustive map.

## Result and scope

We can recover useful mathematical operations and trace them into recognizer
callers. We have **not recovered the complete MG3 algorithm**, its original
source code, a working replacement library, or an accuracy benchmark against it.
The exported C-like files are compiler/decompiler interpretations with missing
types and some incorrect SIMD expressions. No MG3 code, executable, model or
extracted asset is included in this repository.

The largest new finding is a second recognizer path associated with the retained
`MIDIGuitar32Core` subobject. It uses **four windowed FFT analyzers**, whereas the
previously studied `MIDIGuitar31Core` path combines a **nonuniform complex
resonator bank** with another FFT. Calling either “the exact algorithm MG3 uses
for every preset” would overstate the evidence. We traced static callers;
we did not instrument which path Tim's live tracking preset selects.

Our existing browser detector is already a small independent audio-to-notes
implementation. This research gives specific experiments to improve it. This
change adds research tools and documentation; it changes no live detector,
settings, MIDI routing, or application interface.

## Evidence standard

- **Observed:** addresses, machine instructions, constants, constructor arguments,
  memory accesses and direct calls in the pinned executable.
- **Derived:** algebraic simplification of those operations, with an explanation
  of the assumptions. These are our descriptive names, not restored source names.
- **Proposed:** an independently implementable experiment for our codebase.
  A proposal is not a recovered MG3 feature or a measured improvement.

All addresses below are unslid ARM64 virtual addresses, not offsets into the
universal executable, runtime addresses under ASLR, or portable addresses for
other MG3 builds. Check the binary hash before reusing them.

## 1. Two recognizable processing routes

| Route | Static chain | What was established |
| --- | --- | --- |
| 31 core | `0x10030bf78` → initialization `0x1001d1864`; module callback `0x1001c9330` → `0x1001c9628` → `0x10014de5c` | Constructor installs module vtable `0x1010b6300`; core is at module offset `0x2cf0`. Callback obtains an audio block and returns recognizer state through a six-voice adapter. |
| 32 core | module callback `0x1001de04c` → initialization/reconfiguration `0x1001de594` → `0x1001d1ef0` → `0x10014de5c` | The second core is at module offset `0x56b68`, matching the retained core-subobject metadata. The callback scales input, updates controls and runs the recognizer. `0x100330ee8` is another direct caller. |

The cores are substantial: Ghidra initially assigns 27,356 machine-code bytes
to the 31 routine and 37,112 to the 32 routine. Function-size metadata is not a
reliable complexity measure: switch destinations can be absent from a function's
initial declared body, and the decompiler can discover further blocks.

The shared adapter `0x10014de5c` reads recognized voice count and the latest
entries of per-voice circular histories, then populates up to six outputs.
This demonstrates an audio → tracked voices boundary; it is not merely a list
of FFT peaks or a MIDI serializer. A lightweight engine can use the same general
separation: detect notes first, attach a browser-event or MIDI adapter afterward.

## 2. The 31 core's nonuniform frequency bank

### Channel positions

Initialization at `0x1001d12b8` constructs 256 center frequencies. The forward
mapping used by multiple scoring helpers is the inverse of that initialization:

```text
frequency(i) = (i + 5)² / 25.5 Hz, i = 0…255
index(f)     = sqrt(max(f, 0) × 25.5) − 5
```

This is a quadratic grid, **not a logarithmic semitone grid** and not uniform
FFT bins. Examples derived directly from the formula:

| Index | Center frequency |
| --- | ---: |
| 0 | 0.9804 Hz |
| 32 | 53.6863 Hz |
| 64 | 186.7059 Hz |
| 128 | 693.6863 Hz |
| 192 | 1521.9216 Hz |
| 255 | 2650.9804 Hz |

The local spacing is `(2i + 11) / 25.5` Hz. It gets wider as frequency rises.
Many helpers linearly interpolate adjacent channels and return zero when the
index cannot address a valid pair, usually outside `0…254`. A grid endpoint
is not proof that a note at that frequency can be reliably recognized.

### Two bandwidth/time configurations

The 31 core owns bank objects at offsets `+0x7998` and `+0x79a0`. The first is
optional; the second is used unconditionally on the inspected path. Their
configuration arrays begin at `+0x4368` and `+0x4b68`. For channel spacing Δf,
the initial per-channel time parameters derive from `sampleRate / Δf` and
half that value, with a lower bound of 10 and configurable upper bounds.

`0x100132060` sets a configuration vector at `+0x4800` to the integers `[1, 3]`.
The raw vector at binary address `0x1008a2df0` confirms those values. It creates
three complex coefficient pairs around each center. Algebraically:

```text
r = exp(−π / T)
frequency offset for branch j = (sampleRate / T) × (j − 1) / 16, j = 0,1,2
coefficient pair = r × [cos(angle), sin(angle)]
angle = 2π × (centerFrequency + offset) / sampleRate
stored normalization = 1 / (32 × (1 − r))
```

The cosine/sine pair is confirmed by the assembly after `___sincos_stret`
(`0x1001321f8`), which returns two floating-point registers. Ghidra's guessed
signature makes one returned value look like a constant in the C export.
That expression must not be copied literally.

At `0x100130878`, the three complex states are combined with weights
`[−0.5, 1, −0.5]`, then scaled by four divided by the stored normalization.
The assembly at `0x1001309b4…0x1001309fc` loads the real and imaginary vectors
separately. The pseudocode incorrectly shows identical real and imaginary
outputs in part of this loop. That is a **verified decompiler error**.

The coefficient construction, persistent state and weighted complex output
support the interpretation of a recursive, frequency-selective analysis bank.
We have not fully reconstructed the inline update, its input preprocessing,
or its complete transfer function. T is a configuration parameter; calling it
the actual onset latency would be unjustified.

### Companion FFT

Initialization also creates a windowed analyzer with FFT length 4096, window
selector 2, and a separate time-window length. The analyzer output is stored
at core offset `+0x15920` and 1024 bins are requested. Window case 2 implements
the Hamming form `0.54 − 0.46 cos(2πn/(L−1))`.

The core therefore has two different spectral representations to compare:
the nonuniform bank magnitude at `+0x14d20` and the linear-bin FFT magnitude.
A pair of browser AnalyserNodes with different sizes would be a rough experiment,
not a reconstruction of this bank.

## 3. The 32 core's four FFT windows

This is the most directly actionable new finding for a small implementation.
The reconfiguration function `0x1001de594` constructs four analyzers using the
same FFT length but **different nonzero time-window lengths**. All use window
selector 8. The core callback feeds each analyzer the same new audio block,
requests 1024 magnitude bins, and normalizes each spectrum by its own window
length times 0.535.

### Window lengths and lower-note configuration

The reconfiguration argument behaves mathematically as a lower MIDI-note
boundary. The function converts it to a half-semitone-lower frequency:

```text
fLow = 440 × 2^((lowerNote − 0.5 − 69) / 12)
Llong = round(6 × sampleRate / effectiveLow)
FFT length = 4096 if Llong ≤ 4096; otherwise 8192
```

If the longest window would exceed 8191 samples, the code increases the
effective frequency in 5% steps until it fits. This changes the analysis
configuration; it is not evidence of unlimited low-frequency resolution.
The four constructor calls request lengths equivalent to:

```text
2, 1.5, 3, and 6 periods of effectiveLow, respectively
```

For an **illustrative lowerNote = 40 (E2), 48 kHz**, the boundary is 80.0609 Hz
and the constructor requests lengths 1199, 899, 1799 and 3597. The processing
order swaps the first two pointers:

| Buffer in core | Samples | Window span |
| --- | ---: | ---: |
| `+0x5b5c8` | 899 | 18.729 ms |
| `+0x5c5c8` | 1199 | 24.979 ms |
| `+0x5d5c8` | 1799 | 37.479 ms |
| `+0x5e5c8` | 3597 | 74.938 ms |

All four use a 4096-point FFT in that example. These are **window spans**, not
measured detection delays, update rates, or a verified live preset. Zero padding
keeps the bins aligned while the effective time/frequency tradeoff changes.
Simply setting four FFT sizes to these sample counts would be a different design.

The upper frequency bound is derived as `min(fLow × 60, 20000)` and its bin
limit is capped at 1023. This is another argument against blindly copying the
31 core's approximately 2.65 kHz grid limit into a proposed 32-style experiment.

### Window shape: check assembly, not just selector names

The constructor's switch table at `0x1008a7474` sends selector 8 to
`0x1001443a0`. The scalar tail at `0x1001453ac…0x1001453c0` computes:

```text
center = (L − 1) / 2
w[n] = 1 − ((n − center) / center)²
```

That is the parabolic/Welch form. The `fmsub` instruction at `0x1001453b8`
confirms the square. Some optimized vector expressions in Ghidra's pseudocode
lose that square; treating them as a ramp or triangular window is incorrect.
The 0.535 normalization is an observed constant, not a derivation of exact
coherent gain for every finite window length.

The analyzer abstraction shifts persistent sample history, multiplies by its
window, zeroes the remainder of the FFT buffer and invokes an FFT backend.
The Apple backend constructor `0x1001e7c80` includes a vDSP path; forward
magnitude routine `0x1001e87f4` calls `vDSP_ctoz`, `vDSP_fft_zrip` and
`vDSP_zvabs`. The backend abstraction also has other branches. This establishes
an available Accelerate implementation, without proving every live analyzer
selects the same backend.

## 4. Harmonic contrast: what the score actually rewards

The earlier study identified helper `0x1001d038c`. Its arithmetic can now be
stated more precisely. Let `S(f)` interpolate the 31 core's nonuniform magnitude
spectrum. For harmonics h = 1…11, valid samples contribute:

```text
S(hf) − 0.5 S((h − 0.5)f) − sqrt(S((h − 0.33)f) S((h + 0.33)f)) / 3
```

The helper sums those contributions. It checks channel bounds; this equation
omits those guards for readability. The offsets are around **multiples of a
candidate fundamental**, not fixed FFT-bin offsets or fixed cent offsets.
This is evidence for positive harmonic support plus negative off-harmonic
support. It is not a plain harmonic product spectrum, nearest spectral peak,
YIN, or a learned classifier in this helper.

Why it helps: broad or misplaced energy can give a false candidate high positive
harmonic energy, yet also fill its supposed gaps. Why it can hurt: in a chord,
another genuine note can occupy those gaps. Our joint template fit already
makes notes compete; adding this as a universal hard rejection could erase
real voices. Evaluate it against energy left unexplained by other accepted
notes, and retain a no-penalty comparison.

There is an analogous but **different** 32-core helper at `0x1001dc230`.
It chooses a spectral representation based on frequency relative to the low
boundary and combines a coverage score with harmonic contrast. Its per-harmonic
term has the form `sqrt(S(hf)) − sqrt(S((h−0.5)f))`, with no recovered ±0.33
term there. Therefore the 31 formula is not “the MG3 formula” across both paths.
Another helper, `0x1001dcaa0`, contains a gap term multiplied by **−0.0**;
that particular operation supplies no gap penalty. Do not infer an active
penalty merely because an off-harmonic spectrum is read.

## 5. Agreement across representations

31 helper `0x1001d05fc` interpolates harmonic amplitudes from the bank and the
4096 FFT. It samples up to `floor(2650.9805 / f)` harmonics and computes:

```text
agreement = dot(bankHarmonics, fftHarmonics)
            / (norm(bankHarmonics) × norm(fftHarmonics))
```

Zero-norm profiles return zero. In one caller, agreement is compared with the
square root of a configurable value at core offset `+0x127fc`. This is an
observed use, not a fully decoded control range or probability calibration.

32 helper `0x1001db304` uses the same normalized dot-product pattern between
spectra beginning at `+0x5c5c8` and `+0x5d5c8`, using the configured FFT-to-Hz
scale. This supplies evidence that multiple windows are used for **decision
support**, beyond merely having several spectra available.

Agreement is scale-invariant, which makes it useful alongside a separate level
gate. It is not a probability that the note is correct. Two windows can agree
on the same wrong octave, especially during steady state. Near an attack,
short and long windows naturally disagree; demanding immediate agreement would
trade away the responsiveness the shorter window was intended to provide.

Our current detector's three generic harmonic rolloffs are an independent
dictionary design. We did not establish that MG3 uses those profiles or our
nonnegative least-squares solver.

## 6. Explaining spectral energy with a set of candidates

31 helper `0x1001d0d8c` takes a range of 60-byte candidate records and builds a
256-value mask. For each candidate it visits harmonics 1…11, marks the center
and neighboring grid samples, and extends along descending spectral shoulders.
The shoulder comparison includes a factor of 1.05. Marked samples contain the
square root of the observed spectrum. It then returns approximately:

```text
coverage = sum(masked sqrt(spectrum)) / max(sum(sqrt(spectrum)), 1e−5)
```

Overlapping harmonic regions occupy the same mask bins. They are not added
again for each candidate. The wrapper at `0x1001d0b4c` constructs a one-candidate
record and calls this routine. The core also calls it with multiple candidates.
This is stronger evidence for evaluating a candidate **combination** than a
single local spectral threshold.

32 helpers `0x1001dbc38`, `0x1001db838` and `0x1001db438` perform related
single-candidate masking on different linear-bin spectra. Their shoulder
comparison uses 1.01. This does not demonstrate that the complete 32 search is
a greedy algorithm or an NNLS fit. Full candidate-set search, tie breaking,
and all interactions with history remain only partly decoded.

A coverage score alone tends to reward extra voices. In a new implementation,
measure the **incremental** unexplained energy that a new note accounts for,
with a penalty for extra voices. Those choices would be our implementation,
not recovered MG3 thresholds.

## 7. Continuous pitch, history and expression

The 31 core maintains 128 pitch-indexed candidate records with stride `0x3c`.
A record includes flags/state, a floating frequency at offset 4 and harmonic
samples. Only some field roles have been decoded; this is not a safe complete
C struct definition. The local-max helper `0x1001c1024` refines three adjacent
samples by fitting a parabola, returning a sub-channel location and height.
Candidate frequencies therefore need not begin as exact MIDI semitones.

The frequency/note conversions in this path simplify to the standard:

```text
midiPitch = 69 + 12 log2(f / 440)
f = 440 × 2^((midiPitch − 69) / 12)
```

The shared six-voice adapter accesses circular histories with modulo 20. Adjacent
voice records in that output have stride `0x220`; multiple history arrays and
state fields live inside each record. Do not interpret “20 history values” as
20 ms or 20 audio samples without decoding how often they advance.

The 31 core also has persistent per-pitch accumulators and decays. Examples
include max-hold-style updates with factors 0.5 and 0.9, and other state factors
0.99, 0.93 and 0.83. Several stages combine current evidence with prior state.
The 32 wrapper converts a user-controlled value to a coefficient of the form
`exp(−ln(2)/(910x + 6))`. We have not recovered the complete meanings, update
units, or relationship of these quantities to the visible controls. None should
be labeled a recovered universal release-time setting.

General lesson: sustain, release, repeated attacks and pitch evolution are
separate decisions. Our two-frame confirmation, 80 ms release grace and
130 ms retrigger rule are our own smaller state machine, not MG3's timings.

For richer output, retain `{voiceId, frequencyHz, fractionalMidiPitch, level,
attack, release, sampleTime}` internally. The UI can display notes without MIDI;
a MIDI adapter can quantize note-on pitch while retaining fractional pitch for
bend events. Stable voice IDs matter for overlapping notes and expression.

A MIDI/MPE channel is a voice allocation decision, not proof of a physical
string. The retained `StringDetectionProcessor`/`StringDetectionModule` names
are leads only. Their names do not establish reliable physical-string recovery
from mono audio. No such recovery was established in this follow-up.

## 8. Browser and native implementation choices

### Browser route

Our current path uses one browser Blackman-window FFT, a sparse template fit
and tracking, scheduled at most 30 times per second. These already implement
polyphonic recognition; the newly identified differences are richer spectral
representations, additional evidence tests and more extensive state.

A useful next prototype would acquire audio through an AudioWorklet, maintain
one sample history and compute a short and a longer window from the same ending
sample. Keep window centering, gain normalization and timestamps explicit.
An AnalyserNode's built-in analysis applies a Blackman window; it does not expose
arbitrary Welch windows and independent zero-padding length. An exact experiment
with those choices requires our own transform/window implementation.
The [Web Audio specification](https://www.w3.org/TR/webaudio/) describes both
the analysis window and processing model.

Start with two windows, not the whole commercial engine. Reuse our pitch
candidates, joint fit and note/lane adapters. Log harmonic support, gap energy,
coverage, cross-window agreement and residual improvement per candidate before
making any of them a hard rule. Add a four-window comparison only if the two
windows leave a measured problem. WebAssembly is an option if a profile shows
that worklet JavaScript cannot meet the audio processing budget.

Moving analysis off display scheduling can remove render-frame jitter and missed
updates. It does not remove the acoustic information needed to distinguish low
notes or resolve overlapping harmonics, and it does not automatically improve
pitch accuracy.

### Independent native route with MIDI output

A small macOS application is a viable end product. A concrete first design is:

1. Swift shell for device selection and levels; Core Audio/AVAudioEngine input.
2. An independently written detector with configurable window lengths and an
   Accelerate FFT backend. Keep DSP buffers preallocated and avoid UI work,
   file operations or MIDI-client management in the audio callback.
3. A compact voice tracker that emits note-on, note-off, velocity and pitch.
4. A virtual CoreMIDI source, with a note list as the immediate local readout.
5. A browser MIDI adapter when the talk should follow that native detector.

[Apple's virtual MIDI source API](https://developer.apple.com/documentation/coremidi/midisourcecreatewithprotocol(_:_:_:_:))
allows a source to publish events to connected clients. Begin with ordinary MIDI
notes and balanced note-on/off handling, including panic on stop or device
failure. Add per-voice pitch bend/MPE after voice identity is reliable and both
ends agree on the bend range. MIDI transport carries the result; it does not
improve the detector by itself.

Native processing gives us device/audio-callback control and a direct Accelerate
backend. A single shared DSP implementation could later target both native and
WebAssembly, but choosing a new language or framework before the evidence is
measured would add work without demonstrating better note detection.

There is also an immediately usable quality baseline: the licensed MG3
standalone can produce MIDI itself. Its
[official product page](https://jam.live/products/MG3/) describes polyphonic MIDI
and MPE output. Using its normal output can support the talk while independent
research continues. The browser's previous guitar-MIDI input was deliberately
removed; receiving a standalone source would need an explicit product change,
including overlapping-note and disconnect handling. This research does not
silently restore it.

## 9. Experiments that would justify a light replacement

These are ordered by information gained, not a promise of MG3 parity.

| Experiment | Comparison | Evidence needed to keep it |
| --- | --- | --- |
| Record clean DI and MG3 MIDI together | Same performance, current detector vs MG3; hand-check labels | Repeatable misses, extras, onset and release errors; MG3 output is a comparator, not unquestionable ground truth. |
| Two aligned windows | Current single window vs dual window, same candidates/tracker | Lower note error or better attacks at a measured latency and CPU cost. |
| Candidate gap energy | No gap test vs contrast on raw spectrum vs residual spectrum | Fewer false harmonics without losing quiet notes in mixed chords. |
| Cross-window harmonic agreement | Disabled vs scored feature vs hard gate | Gain robustness without excessive onset delay or rejecting bends. |
| Incremental coverage | Existing amplitude octave preference vs marginal residual explanation | Better false-octave/true-octave separation on held-out recordings. |
| Voice lifecycle | Existing tracker vs attack/sustain thresholds and sample-based timing | Reliable fast re-picks, quiet sustain and release without stuck notes. |
| Native/MIDI shell | Same detector/input at matched settings | Measured scheduling/transport benefit, correct notes and note-off behavior. |

The corpus should contain every open string, fretted notes, true octave pairs,
power chords, major/minor open chords, arpeggios, palm mutes, quiet decay,
repeated attacks, slides/bends, pickup changes, gain changes and idle noise.
Keep development recordings separate from evaluation recordings. Include the
current quiet-input and six-note chord regressions: synthetic fixtures are
useful checks, but generic summed harmonics cannot establish real-guitar accuracy.

Report pitch precision/recall, octave-confusion counts, duplicate attacks,
onset error distribution, release delay and processing-time distribution.
Count false positives during silence separately. Timestamps must distinguish
sample position, analysis-window span, detector decision time, MIDI publication
and visible feedback; a fast function benchmark is not an end-to-end latency
measurement.

## 10. Reproducing and continuing the analysis

### Pinned inputs and local artifacts

The original study is preserved at:

```text
/Users/tim.benniks/.codex/analyses/mg3-2026-10-15/
```

This follow-up's independent project copy and exports are at:

```text
/Users/tim.benniks/.codex/analyses/mg3-deep-2026-10-15/
```

| Follow-up artifact | Purpose |
| --- | --- |
| `project/` | Independent copy of the earlier analyzed Ghidra project. |
| `output/` | First frontend/helper survey, 56 exports. |
| `pass2/` | Second core, its helpers and backend methods, 90 exports. |
| `pass3/` | Second-core configuration, callers and tracking leads, 48 exports. |
| `pass4/`, `pass4-verified/` | Focused switch/coefficient assembly checks. |
| `reproducible-export/` | 97 exports from the committed runner, math import models and unchanged instruction bytes. Includes `binary-facts.json` and `ghidra.log`. |
| `reproduce.log` | Runner result and pinned binary-fact summary. |

These export counts overlap; they do not represent 291 distinct understood
functions. Keep the folders locally. A fresh repository checkout contains the
analysis scripts and this report, not the Ghidra/JDK installations or MG3 binary.

```text
Installed universal executable SHA-256:
9dd630985e0d66d4ab957df9acf9122cf60d48b55c456c88f1941d339f008a34

ARM64 study copy SHA-256:
0d2362d7760523f4169d9bbf6cb4ca03b675fda0a36a64b558bbae53129d672d
```

The installed application and ARM64 input copy were read, not patched. The
follow-up exporter does **not** apply the earlier stack-probe NOP. It supplies
standard floating-point math import signatures, disassembles missing analysis
instructions in the temporary view, exports, and discards database changes.
The large cores can consequently still have broken inferred signatures such as
`void` parameters. Use their caller assembly to establish arguments; compare
with the earlier, explicitly modeled export when following their internals.

### Committed tools

From this repository root:

```sh
# Portable checks; no MG3 installation or Ghidra needed.
python3 scripts/research/mg3/research_mg3.py --self-test

# Verify the pinned ARM64 file and print independently decoded binary facts.
python3 scripts/research/mg3/research_mg3.py

# Produce a NEW local export directory. Requires the earlier study and runtimes.
python3 scripts/research/mg3/research_mg3.py \
  --export "$HOME/.codex/analyses/mg3-deep-2026-10-15/next-export"
```

`--study /absolute/path` changes the earlier-study location. The runner rejects
an unknown binary hash, a repository-local export destination, and an existing
output directory. It copies the saved project into an independent `/tmp` path
because Ghidra rejects project path components starting with a dot, including
`.codex`. It enforces `-readOnly -noanalysis`, uses the isolated JDK/Ghidra,
checks the completion log and deletes the temporary project after export.

`DeepMG3.java` additionally checks the program's recorded input hash and ARM64
language. `targets.txt` contains explicitly selected function and confirmed
vtable addresses. RTTI descriptors and base-class offset tables are **not**
virtual-method arrays: the early exploratory pass contained metadata targets
that must not be interpreted that way. The final target list uses the confirmed
module and analyzer vtables instead.

The exporter includes instruction locations from decompiler p-code as well as
the initially declared function body, disassembling previously undefined
instructions. Optimized-away instructions may still be absent from this listing;
use a full listing around a disputed sequence. For the constructor, compare
switch entries 2 and 8 with the raw jump table and inspect their scalar tails.

### Remaining questions worth investigating

- Which of the two recovered core routes does the actual selected live preset use?
- How do the second core's four spectra feed its complete candidate-set search?
- Which fields/control mappings distinguish attack, sustain, release and retrigger?
- What does its additional peak-to-harmonic assignment helper `0x1001dcbc4`
  contribute when harmonic locations deviate or the fundamental is weak?
- What role do the separate final/retrigger modules play in the configured path?
- Can a small original dual-window/residual model beat our current octave filter
  on Tim's recorded guitar while preserving true octave pairs and dense chords?

No dynamic hooks, process-memory modification, licensing bypass, model extraction,
or automated live audio/MIDI capture was performed. The current evidence supports
these targeted experiments; it does not support shipping a purported MG3 clone.
