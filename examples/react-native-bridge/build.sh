#!/bin/bash
set -euo pipefail
route_dir="$(cd "$(dirname "$0")" && pwd)"
bash "$route_dir/../shared/web/package-app.sh" react-native-bridge
