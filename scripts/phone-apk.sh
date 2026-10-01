#!/usr/bin/env bash
# Build a sideload debug APK. Downloads a local JDK + Android SDK into
# ~/.cache/finance-android if this Mac does not already have them.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
CACHE="${FINANCE_ANDROID_CACHE:-$HOME/.cache/finance-android}"
JDK_HOME="$CACHE/jdk-21.jdk/Contents/Home"
SDK_ROOT="$CACHE/sdk"
CMD_LATEST="$SDK_ROOT/cmdline-tools/latest"
JDK_URL="https://github.com/adoptium/temurin21-binaries/releases/download/jdk-21.0.12.1%2B1/OpenJDK21U-jdk_aarch64_mac_hotspot_21.0.12.1_1.tar.gz"
TOOLS_URL="https://dl.google.com/android/repository/commandlinetools-mac-13114758_latest.zip"

mkdir -p "$CACHE" "$SDK_ROOT"

if [[ ! -x "$JDK_HOME/bin/java" ]]; then
  echo "Downloading Temurin 21…"
  curl -fsSL "$JDK_URL" -o "$CACHE/jdk.tgz"
  rm -rf "$CACHE/jdk-unpack" "$CACHE/jdk-21.jdk"
  mkdir -p "$CACHE/jdk-unpack"
  tar -xzf "$CACHE/jdk.tgz" -C "$CACHE/jdk-unpack"
  extracted="$(find "$CACHE/jdk-unpack" -maxdepth 3 -type d -name Home | head -1)"
  if [[ -n "$extracted" ]]; then
    # tarball is already a .jdk bundle
    bundle="$(cd "$extracted/../.." && pwd)"
    mv "$bundle" "$CACHE/jdk-21.jdk"
  else
    echo "Could not find JDK Home in the archive." >&2
    exit 1
  fi
  rm -f "$CACHE/jdk.tgz"
  rm -rf "$CACHE/jdk-unpack"
fi

if [[ ! -x "$CMD_LATEST/bin/sdkmanager" ]]; then
  echo "Downloading Android command-line tools…"
  curl -fsSL "$TOOLS_URL" -o "$CACHE/cmdline-tools.zip"
  rm -rf "$SDK_ROOT/cmdline-tools"
  mkdir -p "$SDK_ROOT/cmdline-tools"
  unzip -q "$CACHE/cmdline-tools.zip" -d "$SDK_ROOT/cmdline-tools"
  if [[ -d "$SDK_ROOT/cmdline-tools/cmdline-tools" ]]; then
    mv "$SDK_ROOT/cmdline-tools/cmdline-tools" "$CMD_LATEST"
  elif [[ -d "$SDK_ROOT/cmdline-tools/bin" ]]; then
    mkdir -p "$CMD_LATEST"
    mv "$SDK_ROOT/cmdline-tools/bin" "$SDK_ROOT/cmdline-tools/lib" "$CMD_LATEST" 2>/dev/null || true
  fi
  rm -f "$CACHE/cmdline-tools.zip"
fi

export JAVA_HOME="$JDK_HOME"
export ANDROID_HOME="$SDK_ROOT"
export ANDROID_SDK_ROOT="$SDK_ROOT"
export PATH="$JAVA_HOME/bin:$CMD_LATEST/bin:$PATH"

yes | sdkmanager --sdk_root="$SDK_ROOT" --licenses >/dev/null || true
sdkmanager --sdk_root="$SDK_ROOT" "platforms;android-35" "build-tools;35.0.0" "platform-tools"

printf 'sdk.dir=%s\n' "$SDK_ROOT" > "$ROOT/android/local.properties"

cd "$ROOT/android"
./gradlew assembleDebug --no-daemon

mkdir -p "$ROOT/mobile"
cp -f "$ROOT/android/app/build/outputs/apk/debug/app-debug.apk" "$ROOT/mobile/Finance-debug.apk"
echo "APK: $ROOT/mobile/Finance-debug.apk"
