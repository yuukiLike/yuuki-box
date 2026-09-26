#!/bin/bash
set -euo pipefail
cd "$(dirname "$0")"
case "${1:-}" in
  swift) app_path="$PWD/swift-native/build/YuukiSwiftNative.app" ;;
  gpui) app_path="$PWD/rust-gpui/build/Yuuki GPUI.app" ;;
  react-native) app_path="$PWD/react-native-bridge/build/YuukiReactNative.app" ;;
  webview) app_path="$PWD/react-webview/build/YuukiReactWebView.app" ;;
  electron)
    if [ ! -f electron/build/latest-path.txt ]; then
      echo "Build the Electron example first." >&2
      exit 1
    fi
    IFS= read -r app_path < electron/build/latest-path.txt
    ;;
  *) echo "Usage: bash examples/open.sh swift|gpui|react-native|webview|electron" >&2; exit 2 ;;
esac
if [ ! -d "$app_path" ]; then
  echo "App does not exist; build this route first: $app_path" >&2
  exit 1
fi
/usr/bin/open "$app_path"
