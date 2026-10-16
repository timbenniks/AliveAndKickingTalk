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

## App icon

`AppIcon.icns` is original vector-drawn artwork: a gold pixel guitar on purple with the website's six fret colors. The editable source and full-size preview are in `../Artwork/`. Regenerate from `native/GuitarMIDI` with:

```sh
swift Artwork/GenerateIcon.swift
iconutil -c icns Artwork/AppIcon.iconset -o Resources/AppIcon.icns
./build.sh
```

The icon contains standard and Retina sizes from 16 to 1024 pixels. The build copies it into the bundle and declares `CFBundleIconFile` before signing.
