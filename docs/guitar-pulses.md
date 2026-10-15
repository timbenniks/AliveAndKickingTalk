# Guitar note and string tracking

Guitar input uses waveform pitch detection instead of six frequency zones.
A picked note produces one gem on an estimated string; its harmonics no longer
independently light other lanes. Backing-track and MIDI detection are unchanged.

The Rig settings include a saved tuning (standard, Drop D, half step down or
whole step down), a saved noise gate (-80 to -30 dBFS, initially -65), and the
current note with its estimated physical string number (6 = lowest string).
Lower the gate for quiet notes; raise it above the idle input noise. The gate
now measures waveform RMS, so it is not equivalent to the previous analyser's
-75 to -25 dB spectrum display window.

Use a clean DI signal before distortion, delay and reverb when possible. Audio
is analysed only, never routed to the speakers. Browser echo cancellation,
noise suppression and automatic gain remain disabled.

## Detection

- Averaged downsampling to approximately 12 kHz bounds pitch-processing cost
  across interface sample rates. Reusable buffers avoid per-analysis arrays.
- A YIN cumulative mean normalized difference finds a periodic fundamental,
  with interpolation between lag samples. A Hann-windowed Goertzel comparison
  checks for a weak fundamental when a strong second harmonic suggests an
  octave too high. The accepted periodicity confidence is at least 0.88.
- The waveform window grows from 35 to 60 ms after an attack. Two consistent
  rounded-pitch readings reject unstable attacks. Detection runs at most 60
  times per second, independently of display refresh rate, and skips pitch
  analysis below the noise gate.
- A separate 16 ms RMS envelope detects re-picking a ringing note. Picks have a
  45 ms debounce rather than the old 130 ms per-lane cooldown. Clear legato
  pitch changes also produce a gem; gradual bends retain their string without
  producing a new gem at each semitone.
- String estimation considers the chosen tuning, a 24-fret range, low fret
  positions, and nearby positions during a phrase. History expires after a
  short gap. Changing source, device, tuning or gate resets detector state.

This is single-note tracking, not polyphonic transcription. Chords may be
rejected or reduced to one periodic pitch. Identical pitches on different
strings remain ambiguous; the string estimate is a heuristic, not measured
physical string identity. MIDI mode remains the precise string route when a
pickup provides one string per configured channel. Harmonics, heavy effects,
very weak fundamentals and noise can still cause misses or octave errors.

## Verification and performance

`npm test` includes waveform checks for all open strings in all four tunings,
every semitone from E2 to E6, 44.1/48/96/192 kHz sample rates, strong harmonics,
weak/missing fundamentals, noise rejection, quiet notes, bends, legato, repeated
picks 100 ms apart, sustain and high-refresh event deduplication. The actual
composable is also tested with fake waveform capture, device request races,
source changes and teardown. No microphone or audio playback is used.

Run `node --experimental-strip-types tests/guitar.mjs --benchmark` for an
isolated CPU check. A local run across 6,000 analyses measured about 0.06 ms
mean, 0.10 ms p95 and 0.12 ms p99, including low notes and rejected noise.
These are Node processing timings, not an in-browser stage FPS measurement.
No dependency, worker or model download is required.

Detection waits for a stable pitch, so visual latency depends on the attack,
frame rate and input interface. The streaming repeated-pick test requires each
gem within 100 ms of its pick. Check the live rig for latency, noise-gate
setting and inferred string choices before presenting; synthetic waveforms do
not establish real-guitar accuracy.
