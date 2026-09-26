#!/bin/bash
set -euo pipefail
script_dir="$(cd "$(dirname "$0")" && pwd)"
app="$script_dir/build/NativeCapabilities.app"
mkdir -p "$app/Contents/MacOS"
cp "$script_dir/Info.plist" "$app/Contents/Info.plist"
xcrun swiftc -swift-version 5 -O -target "$(uname -m)-apple-macos14.0" \
  "$script_dir/Sources/main.swift" "$script_dir/Sources/WhisperSession.swift" -o "$app/Contents/MacOS/native-capabilities" \
  -framework AVFoundation -framework Speech
codesign --force --sign - "$app"
echo "$app/Contents/MacOS/native-capabilities"
