#!/bin/bash
set -euo pipefail
script_dir="$(cd "$(dirname "$0")" && pwd)"
app="$script_dir/build/AgentRuntime.app"
mkdir -p "$app/Contents/MacOS"
cp "$script_dir/Info.plist" "$app/Contents/Info.plist"
xcrun swiftc -swift-version 5 -O -target "$(uname -m)-apple-macos14.0" \
  "$script_dir/Sources/main.swift" -o "$app/Contents/MacOS/agent-runtime" -framework Security
codesign --force --sign - "$app"
echo "$app"
