# Alive and Kicking

**Alive Rig Preview** is the native guitar amp and guitar-to-MIDI app.
Build it with `bash native/GuitarMIDI/build.sh`. Turn the rig off to use
guitar-to-MIDI alongside an external amp such as Neural DSP.
See [the native app guide](docs/alive-rig-preview.md) for setup, saved presets,
effects, MIDI routing, tests and the original-app backup.

Run the talk website:

```sh
nvm use
npm ci
npm run dev
```

Configure `.env` using `.env.example`. The app uses hosted Supabase and Contentstack.

Requires Node 24, matching `.nvmrc` and the CI build.

```sh
npm run typecheck
npm run lint
npm test
npm run build
npm run preview
```

Open `/practise` for audio/MIDI rehearsal without changing the live setlist. The app still uses hosted Supabase; voting and live-show controls affect that database.

See [the modernization record](docs/modernization.md) for the Nuxt 4 branch changes, tests and remaining rollout work.

See [the recovery record](docs/recovery.md) for restored data, environment setup, changes and verification.

https://plausible.io/aliveandkicking.dev/

See [the architecture guide](docs/architecture.md) for code ownership, lifecycle
rules and the test layout.

See [the guitar research handoff](docs/guitar-research-handoff.md) for MG3
analysis findings, potential detection improvements and bug investigation steps.
