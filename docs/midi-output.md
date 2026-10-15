# Amp MIDI output

The Rig keeps **Amp MIDI output** for scheduled amp program changes on channel
1. Choose an output in Rig or `/config`; the device name is saved between
songs and restored on reconnect. Program zero, preset-boundary changes and
retry after a missing/disconnected output remain supported.

Guitar MIDI input, MG3/pickup setup and MIDI lane mapping have been removed.
**Neck follows** now offers only **Track** and **Guitar**. Guitar uses the
browser's Spectrum or Polyphonic notes detector. Old saved MIDI-source
preferences fall back to Track; old input/mapping preferences are ignored.

`tests/stage-audio.mjs` checks output selection, program zero on channel 1,
saved device names, disconnect/reconnect, send failures and listener cleanup.
The output composable never reads MIDI inputs or subscribes to note events.
