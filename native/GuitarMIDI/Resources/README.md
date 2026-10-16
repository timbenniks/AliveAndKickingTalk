# Website typography

These are the same families declared in `app/assets/css/tailwind.css`:

- Jersey 10 Regular: display titles, note labels and stompbox buttons.
- Silkscreen Regular: small uppercase labels.
- Barlow Semi Condensed Regular: controls, body text and help.

Downloaded 2026-10-16 from the Google Fonts repository:

- https://github.com/google/fonts/tree/main/ofl/jersey10
- https://github.com/google/fonts/tree/main/ofl/silkscreen
- https://github.com/google/fonts/tree/main/ofl/barlowsemicondensed

The original font files are unchanged. Each family's SIL Open Font License is included beside its font and copied into the app bundle. Core Text registers them for this process only; no system font installation or runtime download is needed.

The native illustration is drawn in `StageStyle.swift`, adapting the site's `StageSet.vue` cabinets, woven grilles, Benniks nameplates, truss and `NoteHighway.vue` fretboard to a small 2D canvas. Colors match the website's CSS tokens and six pitch lanes. It does not embed the website or run a 3D renderer.
