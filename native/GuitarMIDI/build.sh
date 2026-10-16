#!/bin/bash
set -euo pipefail
cd "$(dirname "$0")"
app="$PWD/dist/Alive Guitar MIDI.app"
mkdir -p "$app/Contents/MacOS" "$app/Contents/Resources"
xcrun swiftc -target "$(uname -m)-apple-macosx14.0" -O -swift-version 5 -parse-as-library Detector.swift AudioMIDI.swift GuitarMIDI.swift StageStyle.swift SelfTest.swift -o "$app/Contents/MacOS/AliveGuitarMIDI"
xcrun coremlcompiler compile Models/nmp.mlpackage "$app/Contents/Resources" >/dev/null
cp Resources/* "$app/Contents/Resources/"
cp Models/LICENSE.basic-pitch "$app/Contents/Resources/"
cp Models/README.md "$app/Contents/Resources/Basic-Pitch-Provenance.md"
cat > "$app/Contents/Info.plist" <<'PLIST'
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
<key>CFBundleIdentifier</key><string>live.aliveandkicking.guitar-midi</string>
<key>CFBundleName</key><string>Alive Guitar MIDI</string>
<key>CFBundleExecutable</key><string>AliveGuitarMIDI</string>
<key>CFBundleIconFile</key><string>AppIcon.icns</string>
<key>CFBundlePackageType</key><string>APPL</string>
<key>CFBundleShortVersionString</key><string>0.2.0</string>
<key>CFBundleVersion</key><string>2</string>
<key>LSMinimumSystemVersion</key><string>14.0</string>
<key>NSMicrophoneUsageDescription</key><string>Detect notes from your guitar input and send them to the Alive Guitar MIDI port.</string>
<key>NSHighResolutionCapable</key><true/>
</dict></plist>
PLIST
codesign --force --sign - "$app"
printf 'Built %s\n' "$app"
