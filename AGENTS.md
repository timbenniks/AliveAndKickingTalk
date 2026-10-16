# Working agreements

- This is the separate Alive Rig Preview clone. Do not use worktrees.
- Preserve the existing voxel/pixel stage, purple/cream/gold palette, six fret colors, and Jersey 10 / Silkscreen / Barlow Semi Condensed fonts. Reuse `native/GuitarMIDI/StageStyle.swift` for new controls.
- Keep the original Alive Guitar MIDI app and the original talk checkout intact. Use the preview's own bundle identifier, executable, settings and MIDI port names.
- Keep note detection independent of amp rendering. Do not run inference, file operations, locks or model destruction in the audio callback.
- After modifying JavaScript files, run `npm run build`, plus typecheck and lint tasks when present. Prefer npm for dependencies.
- Document behavior changes in `docs/`.
- Build the preview with `bash native/GuitarMIDI/build-rig.sh`. Run the app's `--self-test` and the native audio test after engine changes. See `docs/alive-rig-preview.md` for the combined offline test and hardware acceptance checks.
