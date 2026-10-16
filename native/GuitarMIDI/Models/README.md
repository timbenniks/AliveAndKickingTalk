# Basic Pitch model provenance

These are the **unmodified, pretrained Spotify Basic Pitch ICASSP 2022 Core ML weights**. They are not MIDI Guitar 3 weights, and we have not trained a new model.

- Upstream: https://github.com/spotify/basic-pitch
- Revision: `fa5997af0a8210982619003269994a1be25eddf3`
- Upstream directory: `basic_pitch/saved_models/icassp_2022/nmp.mlpackage/`
- Retrieved: 2026-10-16
- Upstream license: Apache-2.0; full text in `LICENSE.basic-pitch`, also copied into the built app.
- The Core ML package's embedded license metadata is empty. The attribution/license here follows the enclosing upstream repository; no additional model-specific license was present in that directory.

SHA-256 of the downloaded files:

| File | SHA-256 |
| --- | --- |
| `nmp.mlpackage/Manifest.json` | `c1fa5ef8acc34703edcd4e90e9a8640bd4673d9f3a68753c3b9d1ca0365e2928` |
| `nmp.mlpackage/Data/com.apple.CoreML/model.mlmodel` | `af7bf7d49bc167e0bf0c30aa2ca6b432c3e10df048d2dd4173ff3a738c020858` |
| `nmp.mlpackage/Data/com.apple.CoreML/weights/weight.bin` | `691a6b63c7ddcdde0ee131ff3986dcb1250df47cd738612efde966ba9b4c99cd` |
| `LICENSE.basic-pitch` | `929c910bae2152fa87199a5d0660e09263419b7eee6d4b301d05ee2aaf211c37` |

The build compiles this package using Apple's Core ML compiler. The adapter, audio capture, MIDI decoder and UI are our own code. No source or weights from JAM Origin are incorporated.
