# Working agreements

- Alive Rig Preview is the main native app, with built-in amp and notes-only modes. Use normal folders, not worktrees.
- Preserve the existing voxel/pixel stage, purple/cream/gold palette, six fret colors, and Jersey 10 / Silkscreen / Barlow Semi Condensed fonts. Reuse `native/GuitarMIDI/StageStyle.swift` for new controls.
- Keep the combined app's existing bundle identifier, executable, settings and MIDI port names stable. The old standalone app is retired; its known-good backup remains available.
- Keep note detection independent of amp rendering. Do not run inference, file operations, locks or model destruction in the audio callback.
- After modifying JavaScript files, run `npm run build`, plus typecheck and lint tasks when present. Prefer npm for dependencies.
- Document behavior changes in `docs/`.
- Build with `bash native/GuitarMIDI/build.sh` (delegates to `build-rig.sh`). Run the app's `--self-test` and the native audio test after engine changes. See `docs/alive-rig-preview.md` for the combined offline test and hardware acceptance checks.
