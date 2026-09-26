#!/bin/bash
set -euo pipefail
script_dir="$(cd "$(dirname "$0")" && pwd)"
examples_dir="$(dirname "$script_dir")"
app="$script_dir/build/YuukiSwiftNative.app"
bash "$examples_dir/shared/native/build.sh"
bash "$examples_dir/shared/runtime/build.sh"
mkdir -p "$app/Contents/MacOS" "$app/Contents/Resources/fixtures" "$app/Contents/Helpers"
cp "$script_dir/Info.plist" "$app/Contents/Info.plist"
cp "$examples_dir/shared/fixtures/events.json" "$examples_dir/shared/fixtures/update.json" \
  "$examples_dir/shared/fixtures/update-current.json" "$examples_dir/shared/fixtures/update-invalid.json" \
  "$app/Contents/Resources/fixtures/"
ditto "$examples_dir/shared/native/build/NativeCapabilities.app" "$app/Contents/Helpers/NativeCapabilities.app"
ditto "$examples_dir/shared/runtime/build/AgentRuntime.app" "$app/Contents/Resources/AgentRuntime.app"
xcrun swiftc -swift-version 5 -O -target "$(uname -m)-apple-macos14.0" \
  "$script_dir/Sources/main.swift" "$script_dir/Sources/AgentWorkbench.swift" -o "$app/Contents/MacOS/yuuki-swift-native" \
  -framework SwiftUI -framework AppKit
codesign --force --sign - "$app"
echo "$app"
