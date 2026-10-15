# Chord-friendly guitar pulses

With **Neck follows → Guitar → Spectrum**, guitar input follows six low-to-high spectrum zones. Each zone uses its
loudest frequency peak, so both quiet single notes and strummed chords can
light the highway. Detection no longer requires one stable fundamental pitch:
chords are not discarded because several notes sound together.

This restores the spectrum response used before the single-note tracker. The
4096-point analyser uses 0.3 smoothing and a -75 to -25 dB window to retain quiet
DI input sensitivity. A rising level triggers gems in up to the three strongest
zones per frame, with the existing 130 ms per-lane cooldown and adaptive
baseline limiting repeats during sustain. All six lane levels can respond to a
chord even though new gems are capped at three per frame.

Spectrum does not estimate note pitches. For note detection, gate/tuning
controls and the Guitar notes panel, select the optional
[polyphonic detector](guitar-polyphonic.md). Both modes share the same guitar
audio input. Guitar input selection and visual offset persist between songs.

Lanes are visual low-to-high energy, not measured physical string identity.
Harmonics can light additional lanes; that is intentional for this audio-reactive
experience. The neck follows either Track or Guitar; guitar MIDI input and
MIDI lane mapping have been removed. Amp MIDI output remains available for
preset changes.

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

In Spectrum mode, the browser analyser and a
peak scan over the guitar frequency range supply the visual response.

An optional [experimental polyphonic detector](guitar-polyphonic.md) is available
under Guitar input → Guitar detection. Spectrum remains the default.
