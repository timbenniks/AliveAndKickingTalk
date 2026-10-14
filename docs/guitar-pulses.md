# Quiet guitar pulses

Guitar input now uses a -75 to -25dB analyser window, 15dB lower than before.
This lets quieter single notes trigger highway pulses. The existing onset
threshold and cooldown still prevent a sustained note from continually
creating new pulses. Song and MIDI sensitivity are unchanged.

Switching sources or connecting a guitar input resets the detection baseline,
so activity from the previous source cannot suppress the first guitar note.

`npm test` exercises the actual audio tick with a simulated -62dB single-note
peak, checking an initial pulse, quiet input, sustained input and a second
note after release. No microphone or audio playback is used. The setting still
needs a check with the live guitar, since the input gain and noise floor depend
on the connected interface.
