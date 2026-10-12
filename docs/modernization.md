# Modernization investigation

Reviewed 9 October 2026. The investigation below is retained as the original plan. Implementation now exists on `modernize/nuxt-4`; it is an experimental branch, not a production promotion.

## Branch implementation

Implemented Nuxt 4.6.0, Vue 3.5.43, Pinia 4.0.3, Supabase module 2.0.10, Tailwind 4 through its Vite plugin, Nuxt Fonts, Nuxt ESLint/ESLint 10 and current WebMidi/carousel/Cloudinary URL tooling. Removed the old Rollup/watcher overrides. Browser code lives in `app/`, shared data contracts and pure helpers in `shared/`, with Nuxt TypeScript project references. Existing database types were relocated and registered with the module; they were not regenerated against the hosted database.

Behavior changes:

- Supabase claims use `sub` for voting, sharing and the administrator check. Existing API keys continue to work; provider credentials remain in Supabase.
- Voting actions clear their pending state on failure, prevent duplicate in-flight submissions and display a retryable error. Failed vote inserts are checked. Mashup selection stays open if saving fails.
- Live display subscriptions consume each INSERT payload for avatar balls and coalesce aggregate reads. They refresh on subscription/reconnection, report connection status and clean up on unmount. Setlist calculation no longer mutates the source song order.
- MIDI offers an output selector, remembers the preferred device, handles permission/device errors and reconnects, and sends program 0 correctly. Empty preset lists are supported. MIDI channel and program numbering are unchanged.
- Playback errors are visible. Audio visualizers, animation frames, intervals and resize listeners are disposed when leaving their components; the visualizer receives the actual audio element rather than reaching into a parent component's internals.
- `/practise` links to new `/practise/:song` rehearsal players. These pages read the catalogue and run local audio/MIDI without writing `active_song` or `songs_played`. Opening `/live/:song` retains its existing live-show behavior.
- The public song catalogue and avatar API have a 60-second cache. Catalogue changes, including preset edits, may take that long to appear in a new request; reload the player before rehearsal. Avatar loading paginates past 1,000 users. User-specific responses are not cached by these handlers.
- Tailwind theme colors and Lato are preserved. The old carousel's component-local @apply rules did not compile through the new pipeline, so those few rules use ordinary CSS. Browser zoom is enabled and audio controls have accessible names.
- Cloudinary mashup composites preserve the selected song order. Invalid share IDs return 404. Image-generation helpers are shared, framework-independent functions.
- CI runs clean install, typecheck, lint, regression checks and production build. No actual Supabase secrets are required for the build-only CI job.

Local checks completed: clean `npm ci`, `npm run typecheck`, `npm run lint`, `npm test`, and `npm run build`. Tests cover Contentstack normalization, preset boundaries/backward seeking, setlist ordering and source immutability, voting failure/retry/duplicate submission, and Cloudinary composite ordering. Browser checks covered desktop landing, GitHub login/callback, the existing five-vote state, carousel navigation, IAC output discovery and brief rehearsal playback/pause with a working visualizer. Audio testing stopped when Tim said he was in a meeting; further checks are silent. Physical amp tones and reconnect behavior still need a supervised rehearsal.

The upgraded local HTTP endpoints returned all nine songs and 936 avatar entries, and both existing share formats rendered server-side. Final silent checks passed for those endpoints, `/login`, `/practise`, and the generated Cloudinary images for both shares. Public build assets contained neither the checked private credentials nor uncompiled @apply directives.

Not part of this branch's database rollout: transactional mashup replacement, database-level vote limits/uniqueness, narrowing public vote columns, JWT/API key rotation or a new hosted test project. The existing delete/insert mashup replacement and public vote read policy remain unchanged. These require a separate reviewed database migration and concurrent-client testing. Twitter and LinkedIn end-to-end login, a burst/reconnect test and mobile visual checks remain outstanding. No production deployment or hosted schema changes were made. Lazy hydration was not added to the mostly static marketing page, where it would add complexity without a measured benefit.

Dependency audit after compatible fixes: `npm audit --omit=dev` reports zero advisories; the full tree reports 15 (1 low, 7 high, 7 critical), including Nuxt build/dev tooling chains through simple-git, node-forge, glob matching and esbuild. This is a dependency inventory result, not proof that every bundled runtime path is unaffected. npm's force-fix suggestion would downgrade Nuxt to 3.7.4 and was not applied. The legacy service-key deprecation warning also remains until a coordinated credential/environment migration.

The local preview uses the existing hosted database. Rehearsal routes avoid writes, but voting/admin/live-song routes still affect that database. Use the rehearsal route while trying the new player.

## Recommendation

Upgrade the existing application to stable Nuxt 4 in small, independently verified changes. Keep Contentstack, hosted Supabase, Cloudinary, Vercel, the current visual design, and the browser-driven performance. The app already uses Vue Composition API and Nitro endpoints; a rewrite is unnecessary.

Use a branch and Vercel preview before promoting to production. Do not enable Nuxt 5 compatibility flags during the Nuxt 4 migration. Keep CSS migration separate from framework/auth changes so visual regressions are easy to isolate.

## Dependency snapshot

Versions below were read from package.json and the npm registry's latest tags on the review date. They are candidates, not a tested lockfile. Recheck peer dependencies when installing.

| Package | Current | Candidate |
| --- | --- | --- |
| Nuxt | 3.10.0 | 4.6.0 |
| Vue | 3.4.15 | 3.5.43 |
| @nuxtjs/supabase | 1.1.6 | 2.0.10 |
| Pinia | 2.1.7 | 4.0.3 |
| @pinia/nuxt | 0.5.1 | 1.0.2 |
| @nuxtjs/tailwindcss | 6.11.2 | 6.14.0 for the initial migration |
| @nuxtjs/google-fonts | 3.1.3 | Consider replacing with @nuxt/fonts 0.14.0 |
| WebMidi | 3.1.8 | 3.3.1 |
| vue3-carousel | 0.3.1 | 0.19.0, separately verify markup/API changes |
| @cloudinary-util/url-loader | 4.2.0 | 6.3.2, separately verify generated composites |

Nuxt 4.6.0 declares Node `^22.22.3 || ^24.15.0 || >=26.0.0`. The recovery's verified Node 22.23.1 qualifies. Pinia 4 requires Vue >=3.5.11, TypeScript >=5.6 and an explicit compatible @vue/devtools-api installation. Avoid an unbounded upgrade command that could target a later major.

## Changes required by the framework upgrade

1. Move browser code into `app/`: pages, components, app.vue and runtime CSS/assets. Move `store/songs.ts` to `app/stores/songs.ts`; use the Pinia module's standard discovery instead of the custom `imports.dirs` and old autoImports option. Keep server/, public/ and nuxt.config.ts at root. Keep design-source PSD files outside runtime app assets. Nuxt supports the old layout, so the move can be its own commit.
2. Split root `types.ts`: generate database types from the hosted schema and put genuinely shared data contracts in `shared/`. Keep browser-specific canvas/audio types in app/. Separate browser Supabase helpers from pure image/setlist helpers; server imports must not pull in browser composables. Update `~/` and relative imports deliberately.
3. Adopt Nuxt's generated TypeScript project references for app/server/shared/node contexts. Add `typecheck` with `nuxt typecheck` and explicit TypeScript/vue-tsc dependencies. Resolve real errors rather than preserving `@ts-ignore`, untyped props and broad `Function` types. The current Song contract also omits band biography/logo fields returned by Contentstack.
4. Change `defineStore({ id: 'song-store', ... })` to `defineStore('song-store', { ... })`. Keep the options-style store initially; converting every action to a setup store is optional.
5. Migrate Supabase user references from full User objects to JWT claims. `store/songs.ts`, `components/songShare.client.vue` and `pages/config.vue` currently read `.id`; v2 uses `.sub`. Check metadata, callback handling, refresh and server authorization too. Fetch the full user explicitly only where needed.
6. Existing Supabase anon/service-role keys remain compatible according to the module migration guide. Move to publishable/secret API keys as a separate coordinated deployment; JWT signing keys and API keys are distinct settings. Keep OAuth credentials in Supabase. Do not rotate credentials or recreate the database just to update Nuxt.
7. Update the Plausible head script in nuxt.config.ts: Unhead 2 removes `hid` and `children`; use supported `key` and `textContent` fields and verify tracking.
8. Review the two useAsyncData callers in band/stats. Nuxt 4 returns shallow data refs, changes default empty values and fetch lifecycle behavior. These callers mostly replace complete results, so deep reactivity is not an obvious blocker. Pinia's nested song mutations are a separate state mechanism and should not be blindly converted to shallow refs.
9. Remove the recovery-only Rollup 4.9.4 override and test whether the watcher override is still necessary with the new toolchain. Preserve a clean install/build check: the Rollup pin previously prevented a real server-bundling failure.
10. Normalize runtime config to matching NUXT_* names, coordinating `.env.example` and Vercel environments. Keep Contentstack/Plausible/service credentials private. Preserve public share SSR and browser-only stage routes while auditing browser globals.

## Reliability improvements found in this code

These are source-review findings, not failures reproduced in this investigation.

| Area | Evidence | Proposed change |
| --- | --- | --- |
| MIDI | midi.client.vue looks up one hard-coded output once, assumes it exists, indexes the first preset even if the list is empty, and starts selectedPreset at 0 | Show permission/device status, retain the IAC default but allow selection, handle disconnect/reconnect and empty presets, use a null unsent sentinel so program 0 is sent initially. Keep channel/program numbering unchanged and verify with the real amp. |
| Voting errors | Several store actions set voting=true then return/throw without clearing it; upvote ignores insert errors | Use try/finally and handle every database error; permit retry without a page reload. |
| Mashup consistency | Replacing a slot deletes then inserts in separate requests | Inspect existing constraints/data, then introduce a transactional database operation or supported atomic upsert with appropriate RLS. Test competing tabs and failures. Do not assume the necessary unique constraint exists. |
| Timers and animation | background slider, stats polling and live-vote canvas have no timer/frame disposal; audio visualizer has no context/frame cleanup; track resize listener persists | Dispose on unmount, disconnect audio nodes and prevent duplicate animation loops. Pass the audio element explicitly instead of reaching into parent instance refs. Handle rejected audio.play() promises. |
| Realtime bursts | Live pages requery aggregate votes and the latest row for each event | Use insert payloads for individual vote balls so simultaneous votes are not replaced by repeated latest-row queries. Coalesce aggregate refreshes; refetch state after reconnect. Existing channel cleanup can become one small composable. |
| Setlist derivation | mergePlayedSongsWithAllSongs sorts the store's array in place | Sort a copy and test ties, played songs and missing content. |
| Public data | recovery.sql grants public SELECT on votes, whose type includes email; users API lists up to 1,000 auth users every request | Verify effective hosted grants, then expose only the public vote/avatar fields needed by the display. Preserve aggregate queries and Realtime behavior when tightening access. Replace or paginate the all-auth-users avatar source before exceeding the cap. |

The commented-out guitar visualizer is inactive and is not evidence of a current microphone leak.

## Useful newer features

- Enable Nuxt DevTools in development to inspect payloads, routes and performance.
- Use Vue 3.5 typed template refs/props when touching player components; this is particularly useful for audio/canvas elements.
- Adopt Nuxt Fonts if it simplifies font delivery and fallback metrics while preserving Lato and existing weights.
- Cache the public song catalogue for a short, explicit freshness window to reduce Contentstack calls during audience arrival. Define how edited presets are refreshed before a show. Never cache personalized/auth responses using the same policy.
- Use lazy loading/hydration only for optional marketing content where measurement shows a benefit. Do not delay MIDI, the play button or live voting subscriptions.
- Add Nuxt ESLint and a small CI workflow for npm ci, typecheck, lint, content normalization checks and build. Add focused tests for preset boundaries/seeking, voting failures and setlist order, plus browser smoke coverage for auth/routes/sharing. Avoid snapshotting every component.
- Add a stage readiness view for MIDI output, backing-track readiness and Realtime connection. This provides more practical value during a conference than introducing another UI framework.

Tailwind 4 is a worthwhile second migration using `@tailwindcss/vite` and CSS theme tokens. The code contains removed `bg-opacity-*` utilities, custom color/font config and extensive @apply rules. Check borders, gradients, spacing and buttons against screenshots. Its documented browser floor is Safari 16.4+, Chrome 111+ and Firefox 128+; decide whether that suits audience phones. Nuxt UI is unnecessary for retaining this design.

## Delivery sequence and exit checks

1. **Foundation:** Nuxt/Vue/Pinia/Supabase upgrade, supported Node version, directory/config changes, regenerated database types and working typecheck. Keep CSS generation and hardware behavior stable. Pass clean install, production build and existing content test; inspect public output for secrets.
2. **Rehearsal reliability:** voting error handling, atomic vote replacement after schema inspection, MIDI connection handling, timer/audio cleanup and Realtime burst/reconnect behavior. Add focused regression checks. Test against a separate hosted Supabase test project/branch for destructive or concurrent vote scenarios; never reset live audience data. No local database is required.
3. **Presentation/tooling:** Tailwind 4, fonts, carousel/Cloudinary upgrades, selected loading improvements and CI. Verify visual parity before promotion.

For each release rehearse anonymous marketing, GitHub/Twitter/LinkedIn login and callback, refreshed sessions, sign-out, admin/non-admin access, both voting modes, vote removal, played-song locks, two-browser live updates, band/stats screens and individual/mashup share SSR/images. Inspect network failures and reconnect recovery.

For MIDI/audio test real IAC output, missing output, denied permission, reconnect, first preset including program 0, every preset boundary, seeking backwards/forwards, pause/resume and switching songs repeatedly. Confirm no duplicate Program Changes and no accumulating timers/audio contexts. Hardware rehearsal cannot be replaced by a successful build.

Preview OAuth needs an explicit allowed callback for the chosen preview domain. A preview connected to production Supabase still changes production data. Keep database changes additive where possible and make application rollback compatibility an explicit check before promoting the Vercel deployment.

## Sources

- [Nuxt 4.6.0 versioned migration guide](https://github.com/nuxt/nuxt/blob/v4.6.0/docs/1.getting-started/18.upgrade.md) — directory layout, TypeScript, Unhead, data fetching and experimental Nuxt 5 behavior.
- [Nuxt registry metadata](https://registry.npmjs.org/nuxt/latest) — current stable version and Node requirement; other package candidates were checked through the equivalent npm registry endpoints.
- [Supabase Nuxt v2 migration](https://supabase.nuxtjs.org/getting-started/migration) — claims and environment compatibility.
- [Pinia Nuxt integration](https://pinia.vuejs.org/ssr/nuxt.html), [v2 migration](https://pinia.vuejs.org/cookbook/migration-v2-v3.html), [Pinia 4 changelog](https://github.com/vuejs/pinia/blob/v4.0.3/packages/pinia/CHANGELOG.md).
- [Tailwind 4 migration](https://tailwindcss.com/docs/upgrade-guide) — Vite integration, CSS changes and browser support.
- [Nuxt performance guide](https://nuxt.com/docs/4.x/guide/best-practices/performance), [Nuxt Fonts](https://github.com/nuxt/fonts).

Investigation validation: source review, published guidance and registry metadata only. No upgrade install, runtime benchmark or hardware test was performed. Build/typecheck compatibility of the proposed versions remains to be established during implementation.
