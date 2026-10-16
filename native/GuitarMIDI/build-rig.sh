#!/bin/bash
set -euo pipefail
cd "$(dirname "$0")"
audio="$PWD/../RigAudio"
cmake -S "$audio" -B "$audio/build" -G Ninja -DCMAKE_BUILD_TYPE=Release
cmake --build "$audio/build" -j 6
app="$PWD/dist/Alive Rig Preview.app"
mkdir -p "$app/Contents/MacOS" "$app/Contents/Resources" "$app/Contents/Frameworks"
xcrun swiftc -target "$(uname -m)-apple-macosx14.0" -O -swift-version 5 -parse-as-library \
    -D RIG_PREVIEW -import-objc-header "$audio/RigAudio.h" \
    -L "$audio/build" -lAliveRigAudio -Xlinker -rpath -Xlinker @executable_path/../Frameworks \
    Detector.swift AudioMIDI.swift GuitarMIDI.swift StageStyle.swift SelfTest.swift \
    RigApp.swift RigControls.swift RigPresets.swift RigSession.swift RigState.swift RigSelfTest.swift \
    -o "$app/Contents/MacOS/AliveRigPreview"
cp "$audio/build/libAliveRigAudio.dylib" "$app/Contents/Frameworks/"
xcrun coremlcompiler compile Models/nmp.mlpackage "$app/Contents/Resources" >/dev/null
cp Resources/* "$app/Contents/Resources/"
cp Models/LICENSE.basic-pitch "$app/Contents/Resources/"
cp Models/README.md "$app/Contents/Resources/Basic-Pitch-Provenance.md"
# Include the pinned dependencies' notices from CMake's actual source directories.
juce_source=$(sed -n 's/^FETCHCONTENT_SOURCE_DIR_JUCE:PATH=//p' "$audio/build/CMakeCache.txt")
nam_source=$(sed -n 's/^FETCHCONTENT_SOURCE_DIR_NAM:PATH=//p' "$audio/build/CMakeCache.txt")
juce_source=${juce_source:-"$audio/build/_deps/juce-src"}
nam_source=${nam_source:-"$audio/build/_deps/nam-src"}
cp "$juce_source/LICENSE.md" "$app/Contents/Resources/LICENSE.JUCE.md"
cp "$nam_source/LICENSE" "$app/Contents/Resources/LICENSE.NAM"
cat > "$app/Contents/Info.plist" <<'PLIST'
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
<key>CFBundleIdentifier</key><string>live.aliveandkicking.rig-preview</string>
<key>CFBundleName</key><string>Alive Rig Preview</string>
<key>CFBundleExecutable</key><string>AliveRigPreview</string>
<key>CFBundleIconFile</key><string>AppIcon.icns</string>
<key>CFBundlePackageType</key><string>APPL</string>
<key>CFBundleShortVersionString</key><string>0.1.0</string>
<key>CFBundleVersion</key><string>1</string>
<key>LSMinimumSystemVersion</key><string>14.0</string>
<key>NSMicrophoneUsageDescription</key><string>Play your guitar through the amp and detect notes for the Alive and Kicking stage.</string>
<key>NSHighResolutionCapable</key><true/>
</dict></plist>
PLIST
codesign --force --sign - "$app/Contents/Frameworks/libAliveRigAudio.dylib"
codesign --force --sign - "$app"
codesign --verify --deep --strict "$app"
printf 'Built %s\n' "$app"
