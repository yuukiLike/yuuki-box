#!/bin/bash
set -euo pipefail

# Called by either route's build.sh. All paths derive from this checkout.
shared_web_dir="$(cd "$(dirname "$0")" && pwd)"
examples_dir="$(cd "$shared_web_dir/../.." && pwd)"
route="${1:?route required}"
case "$route" in
  react-native-bridge) app_name="YuukiReactNative"; bundle_id="dev.yuuki.examples.react-native" ;;
  react-webview) app_name="YuukiReactWebView"; bundle_id="dev.yuuki.examples.react-webview" ;;
  *) echo "Unknown route: $route" >&2; exit 2 ;;
esac

cd "$shared_web_dir"
if [[ ! -f pnpm-lock.yaml ]]; then pnpm install; else pnpm install --frozen-lockfile; fi
pnpm run build

helper="$examples_dir/shared/native/build/NativeCapabilities.app"
bash "$examples_dir/shared/native/build.sh"
bash "$examples_dir/shared/runtime/build.sh"
runtime="$examples_dir/shared/runtime/build/AgentRuntime.app"
app="$examples_dir/$route/build/$app_name.app"
mkdir -p "$app/Contents/MacOS" "$app/Contents/Resources"
cp "$examples_dir/shared/fixtures/events.json" "$app/Contents/Resources/events.json"
cp "$examples_dir/shared/fixtures/update.json" "$app/Contents/Resources/update.json"
cp "$examples_dir/shared/fixtures/update-current.json" "$app/Contents/Resources/update-current.json"
cp "$examples_dir/shared/fixtures/update-invalid.json" "$app/Contents/Resources/update-invalid.json"
ditto "$helper" "$app/Contents/Resources/NativeCapabilities.app"
ditto "$runtime" "$app/Contents/Resources/AgentRuntime.app"
if [[ -f "$examples_dir/shared/native/PrivacyInfo.xcprivacy" ]]; then
  cp "$examples_dir/shared/native/PrivacyInfo.xcprivacy" "$app/Contents/Resources/PrivacyInfo.xcprivacy"
fi
if [[ "$route" == "react-native-bridge" ]]; then
  cp "$examples_dir/$route/build/assets/renderer.cjs" "$app/Contents/Resources/renderer.cjs"
  # Bundle the exact build-machine Node runtime so Finder does not depend on PATH.
  cp "$(command -v node)" "$app/Contents/Resources/node"
  chmod +x "$app/Contents/Resources/node"
else
  mkdir -p "$app/Contents/Resources/web"
  cp "$examples_dir/$route/build/assets/index.html" "$examples_dir/$route/build/assets/app.js" "$examples_dir/$route/build/assets/style.css" "$app/Contents/Resources/web/"
  cp "$examples_dir/$route/build/assets/lab-worker.js" "$app/Contents/Resources/web/lab-worker.js"
fi
cat > "$app/Contents/Info.plist" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
<key>CFBundleIdentifier</key><string>$bundle_id</string>
<key>CFBundleName</key><string>$app_name</string>
<key>CFBundleExecutable</key><string>$app_name</string>
<key>CFBundlePackageType</key><string>APPL</string>
<key>CFBundleShortVersionString</key><string>0.1.0</string>
<key>CFBundleVersion</key><string>1</string>
<key>LSMinimumSystemVersion</key><string>14.0</string>
<key>NSHighResolutionCapable</key><true/>
<key>NSMicrophoneUsageDescription</key><string>仅在点击开始语音后，使用麦克风体验设备端语音识别。</string>
<key>NSSpeechRecognitionUsageDescription</key><string>将用户主动启动的语音转为文字，用于技术路线比较。</string>
</dict></plist>
PLIST
swiftc -swift-version 5 -O -parse-as-library -target arm64-apple-macosx14.0 \
  -framework AppKit -framework WebKit \
  "$shared_web_dir/NativeHostSupport.swift" "$shared_web_dir/AgentRuntimeClient.swift" "$examples_dir/$route/src/Host.swift" \
  -o "$app/Contents/MacOS/$app_name"
codesign --force --sign - "$app/Contents/Resources/NativeCapabilities.app"
codesign --force --sign - "$app/Contents/Resources/AgentRuntime.app"
if [[ "$route" == "react-native-bridge" ]]; then codesign --force --sign - "$app/Contents/Resources/node"; fi
codesign --force --sign - "$app"
codesign --verify --deep --strict "$app"
echo "Built $app"
echo "Launch: open '$app'"
