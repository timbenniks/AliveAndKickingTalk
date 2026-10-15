# Guitar detection: MG3 research and bug handoff

Research date: 15 October 2026. Application baseline: `bc7f1ee`.

Read this alongside [guitar input settings and limitations](guitar-polyphonic.md)
and [application architecture](architecture.md). This document preserves the
research trail so another agent can investigate a reported failure without
repeating the initial executable analysis.

Latest follow-up: [standard MG3 routing, browser failure cases, and the next
useful edge](mg3-detector-edge.md). It adds constructor-backed engine attribution,
continuous-pitch and harmonic evidence, and a documented browser integration
option that requires a newer MG3 version than the installed one.

## Current position

The browser detector is our independent implementation. It contains no Jam
Origin source, extracted models or assets. MG3 research provided evidence for
general approaches to polyphonic recognition; we did not recreate MG3's engine.
Tim reports that the browser approach works surprisingly well, with some
oversensitivity and octave mistakes. MG3 performed better in his live tests.
There is no annotated real-guitar evaluation set or measured end-to-end latency
comparison yet. Synthetic tests cover regressions, not MG3 feature parity.

Keep the product simple: **Neck follows → Track / Guitar**, with **Spectrum /
Polyphonic notes** for Guitar. MIDI guitar input and lane-mapping configuration
were deliberately removed. Amp MIDI program output remains. The Guitar notes
panel is a supported interface feature, not temporary debugging UI.

More reverse engineering is optional. Start with a reproducible audible failure
and improve the smallest relevant part of our engine. For talk visuals, reliable
attacks and sensible lanes matter more than full transcription or MPE features.

## What “seeing the source” actually meant

We inspected the compiled executable installed at:

```text
/Applications/MIDI Guitar 3.app/Contents/MacOS/MIDI Guitar 3
```

It was MIDI Guitar 3 **3.0.74**, a beta build. Its universal macOS executable
contains an ARM64 slice, which we copied into an isolated study directory.
Ghidra disassembled that machine code and generated C-like pseudocode for
selected functions. Some C++ runtime type information (RTTI) survived compilation,
which helped locate likely recognizer objects and follow their references.

This was **decompilation, not access to the original source repository**. Most
names, types, comments and original structure are absent. Compiler optimization,
SIMD instructions and incomplete type recovery make the pseudocode difficult
to interpret. A `.c` export is an analysis artifact, not a compilable replacement
engine. We did not extract a working MG3 library or bypass its licensing.

The REA repository was considered earlier, but the study used official Ghidra
instead. Ghidra 12.1.4 and Eclipse Temurin JDK 21 were installed inside the study
directory, with archive hashes checked against publisher values. The native
Apple Silicon decompiler was built from Ghidra's bundled source. No global Java
or Homebrew configuration was needed, and the installed application was untouched.

## Local evidence and how to resume

The research is outside this Git repository:

```text
/Users/tim.benniks/.codex/analyses/mg3-2026-10-15/
```

These files are available on Tim's machine; a fresh checkout on another machine
does not include them. Preserve the study folder if moving the investigation.
Keep executable copies and proprietary pseudocode out of application commits.

| Path within study directory | Purpose |
| --- | --- |
| `findings.txt` | Original evidence summary, limitations and hashes. Its proposed next experiment predates the browser implementation. |
| `input/MG3-arm64` | ARM64 study copy of the executable. |
| `project/MG3Study.gpr`, `project/MG3Study.rep/` | Saved Ghidra project and database. |
| `scripts/rtti_inventory.py` | Mach-O type-name and raw pointer/reference inventory. Run from the study root. |
| `scripts/SurveyMG3.java` | Ghidra strings, cross-references and external DSP import survey. |
| `scripts/ExportMG3.java` | Selected function/callgraph export; current version includes analysis models described below. |
| `output/rtti.json`, `output/survey.txt` | Indexes used to find recognizer paths. Raw pointer matches alone do not establish execution. |
| `output/targets.txt`, `output/focused-targets.txt` | Address lists used for exports. |
| `output/decompiled/` | Broad initial export: 180 selected functions. |
| `output/focused/`, `output/refined/`, `output/modeled/` | Focused exports: 38 functions each, with successive analysis refinements. |
| `output/*export.log`, `output/analysis.log` | Export completion and analysis diagnostics. |
| `tools/ghidra_12.1.4_PUBLIC/`, `tools/jdk-21.0.12.1+1/` | Isolated analysis runtimes. |

Old logs reference `/tmp/mg3-ghidra-project`; use the saved `project/` copy above
when resuming. Begin by reading existing exports rather than rerunning analysis.

The study's SHA-256 values are:

```text
Original universal executable:
9dd630985e0d66d4ab957df9acf9122cf60d48b55c456c88f1941d339f008a34

ARM64 study copy:
0d2362d7760523f4169d9bbf6cb4ca03b675fda0a36a64b558bbae53129d672d
```

Verify with `shasum -a 256` before trusting any address below. An MG3 update can
change addresses and structures. Retain the original study and create a separate
directory/project for a different binary version.

### Analysis model caveat

The initial decompiler treated a macOS stack-page probe as a generic function
call and lost the core routine's incoming registers. For the modeled export we
supplied standard math signatures and omitted that probe instruction **inside
a transient Ghidra program view**, recovering a plausible two-argument signature.
The read-only project's changes were discarded. Neither the installed executable
nor `input/MG3-arm64` was patched.

The current `ExportMG3.java` writes an ARM64 NOP into the analysis view at
`0x1001c9660`. It is version-specific and is not a passive export script. Use
`-readOnly`, verify the exact binary and compare modeled output with original
disassembly/exports. Do not run it against another version by reusing addresses.
Because the script evolved, rerunning it does not reproduce the initial broad
export's analysis assumptions.

For the matching saved study, this is an example of a new modeled export to a
separate directory. Close any GUI session using the same project first:

```sh
cd /Users/tim.benniks/.codex/analyses/mg3-2026-10-15
JAVA_HOME="$PWD/tools/jdk-21.0.12.1+1/Contents/Home" \
  tools/ghidra_12.1.4_PUBLIC/support/analyzeHeadless \
  "$PWD/project" MG3Study \
  -process MG3-arm64 -readOnly -noanalysis \
  -scriptPath "$PWD/scripts" \
  -postScript ExportMG3.java "$PWD/output/focused-targets.txt" \
  "$PWD/output/modeled-followup"
```

This command is a continuation recipe, not a fresh verification performed by
this documentation change. If artifacts are missing, the reconstruction workflow
is: copy the installed executable, extract its ARM64 slice with `lipo`, record
hashes/version, import into a new Ghidra project, run analysis, survey retained
types/references, then export selected functions. Re-identify addresses before
using any version-specific analysis model.

## What the MG3 analysis established

Ghidra identified 19,580 functions in this ARM64 copy. Retained type names include
`GuitarSpectrumProcessor`, `GuitarRecognitionProcessor7`, `TemporalTracking`,
`MIDIGuitar31Module`, `MIDIGuitar31Core`, `MIDIGuitar32Core` and
`MIDIGuitar31Processor`.

The following roles are inferred from static references, arithmetic and control
flow. They are useful investigation anchors, not original function names:

| Address | Evidence / inferred role |
| --- | --- |
| `0x10030bf78` | Constructor installs the `MIDIGuitar31Processor` virtual table and allocates a `MIDIGuitar31Module`. |
| `0x1001d1864` | Core initialization, reached on a subobject at offset `0x2cf0`. |
| `0x1001c9330` | Module method obtains an input block, calls the core with the subobject and block, then forwards the result. |
| `0x1001c9628` | Large recognizer routine, 27,356 machine-code bytes; accesses persistent spectra, candidate collections and note history. |
| `0x1001c1024` | Local spectral maxima and three-point parabolic peak refinement. |
| `0x1001d038c` | Harmonic evidence accumulation with penalties for intervening spectral evidence. |
| `0x1001d05fc` | Normalized dot-product comparison between harmonic profiles. |

There is concrete evidence for explicit DSP and persistent tracking in this path.
We have not verified which live tracking presets select it, recovered all
parameters/data structures, established whether ML contributes elsewhere, or
measured its individual stages. Type names alone do not answer those questions.
No runtime instrumentation was performed.

## Where our implementation lives

| Repository path | Investigation responsibility |
| --- | --- |
| `shared/stage/guitar-poly.ts` | Harmonic templates, candidate eligibility, joint sparse fit, octave preference, onset/release/retrigger tracking. |
| `shared/stage/guitar-notes.ts` | Note names and pitch-to-lane rules. |
| `app/utils/stage-audio.ts` | Input devices, FFT setup, analysis scheduling, settings and diagnostic state. |
| `app/plugins/rig.ts`, `app/composables/useStageAudio.ts` | Per-Nuxt-app ownership and Vue lifecycle adapter. |
| `shared/stage/clock.ts`, `shared/stage/pulses.ts` | Stage event bus and Spectrum/track pulses. |
| `app/components/stage/StageRigSetup.vue` | Input and detector controls. |
| `app/components/stage/StageGuitarNotes.vue` | Recognized-note display. |
| `tests/guitar-signal.mjs`, `tests/guitar-poly.mjs` | Independent synthetic waveform/FFT fixtures and detector regressions. |
| `tests/stage-audio.mjs` | Browser-engine integration with fake devices and clocks. |

Our detector already fits multiple notes together, refines spectral peaks and
tracks notes over time. Do not propose those as entirely missing capabilities.
It covers MIDI 38–88 (D2–E6), with three generic harmonic rolloffs per pitch,
up to six voices and at most 30 fits per second. Recognition requires fundamental
energy plus two aligned higher harmonics; weak fundamentals remain a limitation.

The gate now applies to overall spectrum-derived RMS, not each FFT bin. The old
per-bin interpretation erased quiet harmonics and caused the “must strum hard”
bug. Matching thresholds scale with the signal and estimated broadband noise.

Balanced octave filtering requires a weaker octave candidate to reach 65% of
the strongest fitted amplitude when **all candidates share one pitch class**.
Strong uses 85%; Off disables it. This is an amplitude preference, not calibrated
confidence. It can reject genuine quiet octave notes and does not address every
octave error in mixed chords. Do not globally force recognition to one note.

Lanes represent pitch ranges starting at E2, A2, D3, G3, B3 and E4; D2 also maps
to the lowest lane. They do not identify physical strings. The same pitch played
on different strings cannot be uniquely located from the pitch alone.

Browser processing already runs on the local CPU. A native app is not required
for the next refinements. Local synthetic benchmarks were around 0.3–0.5 ms per
fit; that excludes the FFT, input buffers, confirmation and rendering. At 48 kHz,
the 4096-sample window spans about 85 ms and note onset needs two fits. Actual
note-to-gem latency remains unmeasured; extra confirmation may hurt responsiveness.

## Research avenues, in priority order

### 1. Capture real failures and compare repeatably

Record short clean DI clips before Neural DSP processing: isolated notes,
repeated muted power chords, open chords, arpeggios, real octave pairs, bends,
decaying notes and string noise. Include the playing that actually fails. Keep
the same clips for every candidate change. Manually annotate intended pitches
and attacks; MG3 MIDI can be a useful time-aligned reference, but is not ground
truth. Offline comparison does not require restoring MIDI input in the product.

Measure extra/missing pitches, octave mistakes, duplicate/missed attacks,
lingering notes, latency and CPU under stage-rendering load. Report these
separately: fewer false notes can conceal more missed quiet notes. This evidence
should decide whether any of the following work is needed.

### 2. Test harmonic contrast and unexplained energy

MG3 helper `0x1001d038c` is evidence for weighing expected harmonic energy against
intervening energy. An independently written score could reject candidates
supported mainly by another note's harmonics. In a chord, energy between one
note's harmonics may belong to another real note: account for the joint fit
before penalizing it. Test both false octave singles and genuine dense chords.

### 3. Improve octave decisions using incremental fit quality

Helper `0x1001d05fc` suggests normalized harmonic-profile agreement. Our fit
already normalizes initial template support and jointly explains partials.
A next experiment could ask how much an additional octave voice improves the
residual explanation, and whether it has independent spectral/attack support.
Compare against the existing amplitude-ratio filter. Preserve real octave pairs;
avoid replacing one blunt threshold with several unmeasured thresholds.

### 4. Refine temporal decisions for demonstrated attack/release bugs

MG3's retained types and recognizer state support investigating temporal tracking.
Our engine already has two-fit onset confirmation, 80 ms release grace and a
130 ms per-note retrigger interval, with stronger repeated attacks able to
retrigger held notes. If recordings show flicker or missed repeated notes,
test attack-aware evidence or separate onset/sustain thresholds. Measure the
added delay and preserve fast repeated playing.

### 5. Explore guitar-specific timbres only if generic templates fail

Independent calibration from Tim's clean notes could help with pickup-dependent
harmonic balance and weak fundamentals. Keep generic templates as a fallback
and test held-out playing, gain changes and other pickup positions. Calibration
is a proposal for our engine; we did **not** establish that MG3 uses this method.

Multiple analysis windows, inharmonicity models or more adaptive tuning are
lower-priority hypotheses, also unconfirmed in MG3. Add them only for measured
failure cases, with an explicit CPU and latency comparison. Investigate runtime
MG3 path selection only when a specific unanswered question warrants it.

## Bug investigation checklist

1. Record the app commit, browser, interface/input channel, sample rate, guitar
   tuning/pickup, gate, tuning offset and octave-filter setting. State whether
   the browser receives clean DI while Neural DSP handles monitoring separately.
2. Describe expected and displayed note names, whether the error occurs on attack
   or decay, and whether the note panel or only the gems are wrong. Include a
   short repeatable playing pattern and, when available, a clean recording.
3. If signal stays below the gate, inspect input selection/gain/gate first. If
   signal is above the gate but notes are wrong, inspect spectral eligibility
   and fit/tracking. Correct note names with wrong gems point to lane/event
   routing or stage consumption. Distinguish pitch-range behavior from a bug.
4. Add the smallest meaningful regression in `tests/guitar-poly.mjs` for pitch
   logic or `tests/stage-audio.mjs` for integration. Use the existing independent
   waveform generator; do not construct fixtures directly from detector atoms
   or relax chord assertions merely to make a patch pass.
5. Compare the same failures and previously working chords before/after. Recheck
   quiet playing, hiss-only input, genuine octaves, repeated attacks and decay.
   Synthetic coverage complements an actual guitar rehearsal.
6. For application changes run `npm run build`, then `npm run typecheck`,
   `npm run lint` and `npm test`. Build/typecheck must run sequentially because
   both generate Nuxt types. Document changed behavior and remaining tradeoffs.

Useful historical commits: `7d18f2a` introduced the independent polyphonic
prototype, `46249cb` corrected quiet-input gating, `ab0f896` added octave filtering,
`2bf1661` simplified input selection and promoted the notes panel, and `bc7f1ee`
clarified runtime ownership. Start from current code; historical MIDI input is
not a feature to restore during routine detector fixes.

## Suggested next-agent brief

> Read docs/guitar-research-handoff.md, docs/guitar-polyphonic.md and
> docs/architecture.md. Reproduce the reported clean-DI failure before changing
> thresholds. Keep polyphonic chords, Track/Guitar selection and the Guitar notes
> panel. Inspect the existing detector and tests first; use the local MG3 study
> only for a concrete unresolved question, distinguishing static inference from
> verified behavior. Implement the smallest independent correction, add a useful
> regression, document tradeoffs and run the required checks. Report what still
> needs a physical-guitar test.

## Deeper follow-up

[The deeper MG3 analysis](mg3-deep-analysis.md) extends this first study with the
31 core's nonuniform resonator banks, a second core's four FFT windows, recovered
harmonic contrast/coverage/agreement operations, and browser/native-MIDI options.
It also includes a hash-checked reproduction tool under `scripts/research/mg3/`.
Read its evidence caveats before treating any formula as the complete recognizer.
