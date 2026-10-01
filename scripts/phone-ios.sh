#!/usr/bin/env bash
# Sync the iPhone app and open it in Xcode so you can Run it on a device.
# iOS will not install an unsigned IPA the way Android sideloads an APK —
# Xcode + a free Apple ID on the connected iPhone is the install path.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
ICON_SRC="$ROOT/resources/icon.png"
ICON_DST="$ROOT/ios/App/App/Assets.xcassets/AppIcon.appiconset/AppIcon-512@2x.png"

if [[ -f "$ICON_SRC" ]]; then
  sips -s format png -z 1024 1024 "$ICON_SRC" --out "$ICON_DST" >/dev/null
fi

XCODE_APP=""
if [[ -d /Applications/Xcode.app ]]; then
  XCODE_APP=/Applications/Xcode.app
elif [[ -d "$HOME/Applications/Xcode.app" ]]; then
  XCODE_APP="$HOME/Applications/Xcode.app"
fi

if [[ -z "$XCODE_APP" ]]; then
  cat <<EOF
Finance for iPhone is in ios/App/App.xcodeproj.

Apple will not install an iPhone app from a file the way Android does with an APK.
Install Xcode from the App Store (once), then:

  sudo xcode-select -s /Applications/Xcode.app/Contents/Developer
  npm run phone:ios

In Xcode:
  1. Connect the iPhone, unlock it, tap Trust.
  2. Select the App target → Signing & Capabilities → Team (your Apple ID).
  3. On the iPhone: Settings → Privacy & Security → Developer Mode.
  4. Pick the iPhone in the scheme menu and press Run.

Same pairing as Android: Tailscale on both, Finance open on the Mac,
Nastavitve → Telefon, paste host + code in the iPhone app.
EOF
  exit 1
fi

if ! xcodebuild -version >/dev/null 2>&1; then
  echo "Xcode is installed, but this Mac is still using Command Line Tools."
  echo "Run: sudo xcode-select -s $XCODE_APP/Contents/Developer"
  exit 1
fi

cd "$ROOT"
npx cap open ios
