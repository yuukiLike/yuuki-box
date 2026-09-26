#!/bin/bash
set -euo pipefail
script_dir="$(cd "$(dirname "$0")" && pwd)"
profile="${1:-${PROFILE:-debug}}"
if [[ "$profile" == --release ]]; then profile=release; fi
if [[ "$profile" != debug && "$profile" != release ]]; then
  echo "Usage: ./build.sh [debug|release|--release] (or PROFILE=release)" >&2
  exit 2
fi
if [[ "$profile" == release ]]; then
  CARGO_TARGET_DIR="$script_dir/target" cargo build --manifest-path "$script_dir/Cargo.toml" --locked --release
else
  CARGO_TARGET_DIR="$script_dir/target" cargo build --manifest-path "$script_dir/Cargo.toml" --locked
fi
bash "$script_dir/../shared/native/build.sh"
bash "$script_dir/../shared/runtime/build.sh"
app="$script_dir/build/Yuuki GPUI.app"
mkdir -p "$app/Contents/MacOS" "$app/Contents/Resources/fixtures"
cp "$script_dir/target/$profile/yuuki-gpui" "$app/Contents/MacOS/yuuki-gpui"
cp "$script_dir/Info.plist" "$app/Contents/Info.plist"
cp "$script_dir/../shared/fixtures/events.json" "$app/Contents/Resources/fixtures/events.json"
cp "$script_dir/../shared/fixtures/update.json" "$app/Contents/Resources/fixtures/update.json"
cp "$script_dir/../shared/fixtures/update-current.json" "$app/Contents/Resources/fixtures/update-current.json"
cp "$script_dir/../shared/fixtures/update-invalid.json" "$app/Contents/Resources/fixtures/update-invalid.json"
ditto "$script_dir/../shared/native/build/NativeCapabilities.app" "$app/Contents/Resources/NativeCapabilities.app"
ditto "$script_dir/../shared/runtime/build/AgentRuntime.app" "$app/Contents/Resources/AgentRuntime.app"
codesign --force --sign - "$app/Contents/Resources/NativeCapabilities.app"
codesign --force --sign - "$app/Contents/Resources/AgentRuntime.app"
codesign --force --sign - "$app"
echo "$app"
