#!/bin/bash
set -euo pipefail
cd "$(dirname "$0")/.."
bash examples/swift-native/build.sh
bash examples/rust-gpui/build.sh
bash examples/react-native-bridge/build.sh
bash examples/react-webview/build.sh
bash examples/electron/build.sh
