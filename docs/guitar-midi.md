# Guitar MIDI from MG3 or a pickup

MG3 and similar audio-to-MIDI apps can send an entire chord on one MIDI channel.
The browser now defaults to mapping MIDI note pitches into low-to-high lanes,
independently of channel. Previously channel 1 always selected the leftmost lane,
so MG3's correctly detected notes all appeared there.

## MG3 setup

1. Keep MG3 listening to the clean guitar input that is tracking successfully.
2. Add Essentials → MIDI Output to its chain.
3. Select MIDI Guitar Virtual Output and MIDI 1.0 Legacy, channel 1.
4. In the website's Rig settings choose Guitar MIDI as the lane source.
5. Select that virtual port under Guitar MIDI input, then choose
   Note pitches · MG3 / audio-to-MIDI under MIDI lane mapping.

The browser accepts note-on/off messages on all 16 channels in note-pitch mode,
so multi-channel output can also feed the visuals. Pitch-bend and other MPE
expression are not currently mapped to visual effects. Choosing MIDI input does
not route sound or change the separate amp MIDI output/program changes.

The six pitch lanes begin at standard tuning's E2, A2, D3, G3, B3 and E4:
MIDI notes <=44, 45–49, 50–54, 55–58, 59–63 and >=64 respectively. This makes an
open E-major chord span all six lanes. These are pitch ranges, not physical
string identification; high notes can share the rightmost lane. There is no
fret/string inference or audio pitch processing in the browser's MIDI path.

Every note-on can launch a gem, including repeated picks and simultaneous chord
notes. Held notes are tracked by channel and note number. Each lane keeps the
strongest remaining held-note level when another note releases, and note-offs
do not launch gems. A velocity-zero note-on is handled as a release. MIDI All
Sound Off/All Notes Off (CC120/123) clear the sending channel's held notes.
Changing input or mapping, losing the device, or unmounting the last MIDI user
releases held lane levels. An unrelated device connection does not interrupt a
still-connected input.

## Per-string pickups

Choose String channels · pickup (1–6) to retain the earlier channel mapping:
channels 1–6 correspond to lanes 1–6. Match the pickup's channel order to the
visual lanes. Channels outside 1–6 are ignored in this mode. Input choice and
mapping are saved between songs.

`npm test` runs the actual MIDI composable into the stage clock with simulated
WebMIDI ports. It covers a channel-1 MG3 chord across all lanes, overlapping
notes, the same pitch on different channels, repeated picks, velocity-zero
release, panic messages, port refresh/disconnection and saved pickup mode.
No MIDI hardware or audio device is opened by the test.
