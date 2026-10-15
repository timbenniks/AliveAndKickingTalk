# Application architecture

The code uses Nuxt's application boundary, Vue composables for component
lifecycles, Pinia for catalogue/voting state, and small framework-independent
modules for algorithms. No new dependencies or custom dependency container
are required.

## Where code belongs

| Location | Responsibility |
| --- | --- |
| `app/pages/` | Routes, loading route data, host checks and page composition. |
| `app/components/` | UI and user interactions. Stage rendering lives in `stage/`; reusable visual controls live in `ui/`. |
| `app/composables/` | Vue lifecycle integration, subscriptions and derived UI state. |
| `app/plugins/rig.ts` | Creates audio, amp MIDI and display instances for each Nuxt app and disposes them when that app unmounts. |
| `app/utils/stage-audio.ts` | Browser audio resources, input races, analysis scheduling and the stage clock bridge. |
| `app/utils/midi-output.ts` | Amp output discovery, permissions, reconnects and program changes. WebMIDI is imported on demand. |
| `app/utils/rig-display.ts` | Display preferences, loaded once per app. |
| `app/utils/preferences.ts` | Safe browser storage access. |
| `app/stores/songs.ts` | Catalogue/vote/config state and authenticated database actions. |
| `app/types/` | Browser/UI-only contracts, such as audio player events. |
| `shared/stage/`, `shared/show/`, `shared/utils/` | Detection, timing, stage definitions and pure domain rules, usable without Nuxt setup. |
| `shared/types/` | Song and database contracts shared with the server. |
| `server/api/`, `server/lib/` | Server endpoints, secrets, upstream requests and content normalization. |

A new guitar algorithm belongs beside `shared/stage/guitar-poly.ts`, not in a
Vue component. A browser device operation belongs in the audio or MIDI runtime.
A new stage readout consumes `useStageAudio()` rather than creating another
analyser, stream or animation loop. Keep calibration controls available for
real hardware; avoid adding service/repository layers around a single call.

The [guitar research handoff](guitar-research-handoff.md) records the local MG3
analysis, evidence limits, potential detector refinements and bug triage steps.

## Runtime ownership

`useStageAudio()`, `useMidi()` and `useRigDisplay()` are thin adapters over the
instances provided by Nuxt. Their reactive state is no longer shared across
server requests through module-level refs. Creating the plugin does not open
hardware, access storage or start frame loops during SSR.

Audio and MIDI are acquired on component mount and released on unmount. The
last audio consumer closes its context, stops input tracks and cancels its
frame loop; pending input requests are invalidated. The last MIDI consumer
removes its connection listeners, including when permission resolves late.
Frame observers return an unsubscribe; the Vue adapter registers that with
component cleanup. App disposal also stops preference watchers.

The deliberately nonreactive `shared/stage/clock.ts` remains the client stage's
frame bus. Three.js components read it directly instead of putting per-frame
buffers and mesh state into Pinia or Vue's reactive graph. It is not persisted
or sent in Nuxt's server payload. The application presents one active stage
per browser page; multiple simultaneous stage clocks are not supported.

Component-owned database subscriptions use `useDatabaseChanges()`. It captures
the Supabase client during setup, subscribes on mount and removes only its own
channel on unmount. It does not overwrite `window.onbeforeunload`. The more
specialized live vote/show channels retain their own reconnect/presence logic.

The optimistic vote queue is private to each Pinia store instance. Its callbacks
and busy state cannot accidentally target the first store created in another
app or test. Queues stay outside serializable store state.

## Tests

Run `npm test` for the complete local suite; no test needs a real microphone,
MIDI interface or database. Runtime factories can be imported directly:

```ts
const audio = createStageAudio();
audio.acquire();
const unsubscribe = audio.onTick(updateHud);
// When the consumer leaves:
unsubscribe();
audio.release();
// When the app is disposed:
audio.dispose();
```

- `tests/guitar-poly.mjs`: real generated waveforms through an independent FFT,
  pitch/chord regressions, octave filtering, quiet input, noise and fit timing.
- `tests/stage-audio.mjs`: the actual browser engine with fake browser devices
  and clocks. It tests stream races, shared ownership, notes-to-lanes, observer
  cleanup and teardown without faking Vue refs or lifecycle hooks.
- `tests/midi-output.mjs`: output selection, saved ports, channel/program zero,
  failures, reconnects, shared ownership and abandoned permission requests.
- `tests/rig-settings.mjs`: independent app settings, storage hydration, saved
  visibility, watcher disposal and blocked storage.
- `tests/vote-store.mjs`: two real Pinia instances with in-memory write stubs.
- `tests/database-changes.mjs`: subscription timing, event filtering and cleanup.
- The existing content, stage, show, image and performance tests cover the
  remaining pure rules.

After changing application code, run `npm run build`, `npm run typecheck`,
`npm run lint` and `npm test`. Run build and typecheck sequentially: both Nuxt
commands generate type files. Builds/tests complement a real guitar/amp and
live-show rehearsal; they do not establish physical input accuracy.

## Cleanup behavior changes

Track/Guitar sources, Spectrum/Polyphonic notes, octave filtering, the notes
panel, persisted preference keys and amp program numbering are unchanged.
Display preference loading no longer schedules writes that can overwrite newer
values. Separate app/store instances have isolated runtime state and vote
queues. Switching audio elements also disconnects the previous pulse analyser.
Unused helper wrappers, the unused played-song getter, duplicate vote/audio
contracts and the nonexistent `/slides` route rule have been removed.

Components were checked for imports and template usage before removal; every
current component has a caller. Source artwork and audio assets can be selected
through CMS content, so missing literal template references alone are not a
reason to delete them. Peer dependencies required by Pinia/TresJS remain
explicit even when application code does not import them directly.
