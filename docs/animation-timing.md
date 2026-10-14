# Animation timing

Audio smoothing, lane detection baselines, idle lane fades, fret flashes and
lighting fades now use elapsed seconds instead of fixed steps per frame. Their
existing 60fps response is preserved, so connecting a screen with a different
refresh rate does not speed up or slow down those effects. The lighting chase
cooldown now lasts 0.55 seconds regardless of the frame rate.

Rendering still follows the browser's animation loop. This change does not cap
the frame rate or guarantee 60fps. Existing movement timing and the audio
engine's 100ms cap after a stalled frame remain in place.

`npm test` checks fades, smoothing and lane baselines at 30, 60, 120 and 144fps,
including the actual audio tick with a simulated clock and no audio playback.
