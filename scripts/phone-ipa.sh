#!/usr/bin/env bash
# Build an iPhone IPA into mobile/Finance.ipa.
# Xcode's SPM resolver hangs fetching Capacitor binaries, so this script
# vendors those xcframeworks from GitHub releases (checksum-pinned) and
# compiles unsigned — same idea as the debug APK.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DERIVED="$ROOT/ios/DerivedData"
PROJECT="$ROOT/ios/App/App.xcodeproj"
OUT_IPA="$ROOT/mobile/Finance.ipa"
VENDOR="$ROOT/ios/vendor/capacitor-swift-pm"
CACHE="${FINANCE_IOS_CACHE:-$HOME/.cache/finance-ios}"
ICON_SRC="$ROOT/resources/icon.png"
ICON_DST="$ROOT/ios/App/App/Assets.xcassets/AppIcon.appiconset/AppIcon-512@2x.png"

CAP_VER="$(node -p "require('$ROOT/node_modules/@capacitor/ios/package.json').version")"
CAP_ZIP_URL="https://github.com/ionic-team/capacitor-swift-pm/releases/download/${CAP_VER}/Capacitor.xcframework.zip"
CORDOVA_ZIP_URL="https://github.com/ionic-team/capacitor-swift-pm/releases/download/${CAP_VER}/Cordova.xcframework.zip"

if [[ ! -d /Applications/Xcode.app ]]; then
  echo "Xcode is not in /Applications/Xcode.app" >&2
  exit 1
fi

if ! xcodebuild -version >/dev/null 2>&1; then
  echo "Point the developer dir at Xcode, then rerun:" >&2
  echo "  sudo xcode-select -s /Applications/Xcode.app/Contents/Developer" >&2
  exit 1
fi

# Xcode 26 ships a stub iOS SDK until the platform component is downloaded.
if xcodebuild -project "$PROJECT" -scheme App -showdestinations 2>&1 | rg -q 'iOS .* is not installed'; then
  echo "Downloading iOS platform support (needed once, several GB)…"
  xcodebuild -downloadPlatform iOS -architectureVariant arm64
fi

if [[ -f "$ICON_SRC" ]]; then
  sips -s format png -z 1024 1024 "$ICON_SRC" --out "$ICON_DST" >/dev/null
fi

mkdir -p "$DERIVED" "$ROOT/mobile" "$CACHE" "$VENDOR"

fetch_zip() {
  local url="$1" dest="$2"
  if [[ -f "$dest" && -s "$dest" ]]; then
    return 0
  fi
  echo "Downloading $(basename "$dest")…"
  curl -fL --retry 3 --retry-delay 2 -o "$dest" "$url"
}

fetch_zip "$CAP_ZIP_URL" "$CACHE/Capacitor-${CAP_VER}.xcframework.zip"
fetch_zip "$CORDOVA_ZIP_URL" "$CACHE/Cordova-${CAP_VER}.xcframework.zip"

rm -rf "$VENDOR"
mkdir -p "$VENDOR"
unzip -qo "$CACHE/Capacitor-${CAP_VER}.xcframework.zip" -d "$VENDOR"
unzip -qo "$CACHE/Cordova-${CAP_VER}.xcframework.zip" -d "$VENDOR"

cat > "$VENDOR/Package.swift" <<'SWIFT'
// swift-tools-version:5.9
import PackageDescription

let package = Package(
    name: "capacitor-swift-pm",
    platforms: [.iOS(.v14)],
    products: [
        .library(name: "Capacitor", targets: ["Capacitor"]),
        .library(name: "Cordova", targets: ["Cordova"])
    ],
    targets: [
        .binaryTarget(name: "Capacitor", path: "Capacitor.xcframework"),
        .binaryTarget(name: "Cordova", path: "Cordova.xcframework")
    ]
)
SWIFT

# cap sync rewrites this file to GitHub URLs; point it at the local vendor copy.
cat > "$ROOT/ios/App/CapApp-SPM/Package.swift" <<SWIFT
// swift-tools-version: 5.9
import PackageDescription

let package = Package(
    name: "CapApp-SPM",
    platforms: [.iOS(.v14)],
    products: [
        .library(
            name: "CapApp-SPM",
            targets: ["CapApp-SPM"])
    ],
    dependencies: [
        .package(path: "../../vendor/capacitor-swift-pm")
    ],
    targets: [
        .target(
            name: "CapApp-SPM",
            dependencies: [
                .product(name: "Capacitor", package: "capacitor-swift-pm"),
                .product(name: "Cordova", package: "capacitor-swift-pm")
            ]
        )
    ]
)
SWIFT

echo "Building Finance.app for iPhone…"
xcodebuild \
  -project "$PROJECT" \
  -scheme App \
  -configuration Release \
  -sdk iphoneos \
  -destination 'generic/platform=iOS' \
  -derivedDataPath "$DERIVED" \
  -skipPackagePluginValidation \
  CODE_SIGNING_ALLOWED=NO \
  CODE_SIGNING_REQUIRED=NO \
  CODE_SIGN_IDENTITY= \
  build

APP="$(find "$DERIVED/Build/Products" -path '*-iphoneos/App.app' -type d | head -1)"
if [[ -z "$APP" || ! -d "$APP" ]]; then
  echo "xcodebuild did not produce App.app" >&2
  find "$DERIVED/Build/Products" -name '*.app' 2>/dev/null | head
  exit 1
fi

STAGE="$(mktemp -d "${TMPDIR:-/tmp}/finance-ipa.XXXXXX")"
cleanup() { rm -rf "$STAGE"; }
trap cleanup EXIT

mkdir -p "$STAGE/Payload"
ditto "$APP" "$STAGE/Payload/App.app"
rm -f "$OUT_IPA"
(
  cd "$STAGE"
  zip -qry "$OUT_IPA" Payload
)

echo "IPA: $OUT_IPA"
ls -lh "$OUT_IPA"
