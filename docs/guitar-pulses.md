# Chord-friendly guitar pulses

Guitar input follows six low-to-high spectrum zones again. Each zone uses its
loudest frequency peak, so both quiet single notes and strummed chords can
light the highway. Detection no longer requires one stable fundamental pitch:
chords are not discarded because several notes sound together.

This restores the spectrum response used before the single-note tracker. The
4096-point analyser uses 0.3 smoothing and a -75 to -25 dB window to retain quiet
DI input sensitivity. A rising level triggers gems in up to the three strongest
zones per frame, with the existing 130 ms per-lane cooldown and adaptive
baseline limiting repeats during sustain. All six lane levels can respond to a
chord even though new gems are capped at three per frame.

The pitch detector, string-position heuristic, tuning selector, noise-gate
slider and detected-note display have been removed. Saved settings from that
experiment are ignored. The Rig panel describes the lanes as frequency
activity. Guitar input selection and visual offset still persist between songs.

Lanes are visual low-to-high energy, not measured physical string identity.
Harmonics can light additional lanes; that is intentional for this audio-reactive
experience. MIDI mode still accepts per-string channels when exact string
mapping is available. Backing-track and MIDI sensitivity are unchanged.

Input remains analysis-only and never feeds the speakers. Browser echo
cancellation, noise suppression and automatic gain remain disabled. Source and
device changes reset the detection baseline. A live check is still needed for
the actual interface gain and noise floor.

`npm test` exercises the actual audio tick with a simulated quiet single-note
peak, release and repeat picking, and an E-major chord spectrum with harmonics.
Chord checks cover immediate multi-lane pulses, all six lane levels, release
and re-strum, and settled sustain at 30/60/120/144 Hz display refresh rates.
Device request races, stale failures and teardown remain covered. These tests
use fake analyser data and never open a microphone or play audio.

The custom waveform pitch-processing loop is gone; the browser analyser and a
peak scan over the guitar frequency range supply the visual response.

An optional [experimental polyphonic detector](guitar-polyphonic.md) is available
under Guitar input → Guitar detection. Spectrum remains the default.
