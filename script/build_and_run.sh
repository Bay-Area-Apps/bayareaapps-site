#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
MODE="${1:-run}"
APP_NAME='Bay Area Apps'
BUNDLE_ID='com.bayareaapps.StudioCompanion.mac'
APP_DIR="$ROOT_DIR/apple-app"
ARTIFACT_DIR="$ROOT_DIR/.build-artifacts"
DESTINATION="$HOME/Applications/$APP_NAME.app"
APP_BINARY="$DESTINATION/Contents/MacOS/$APP_NAME"
STAGING_DIR=''
BACKUP=''

case "$MODE" in
  run|--verify|verify|--debug|debug|--logs|logs|--telemetry|telemetry) ;;
  *) echo "Usage: $0 [run|--verify|--debug|--logs|--telemetry]" >&2; exit 2 ;;
esac
if [[ $# -gt 1 ]]; then
  echo "Usage: $0 [run|--verify|--debug|--logs|--telemetry]" >&2
  exit 2
fi
if [[ "$(uname -s)" != Darwin ]]; then
  echo 'A Mac with Xcode is required.' >&2
  exit 1
fi

if [[ -n "${XCODEGEN:-}" ]]; then
  XCODEGEN_BIN="$XCODEGEN"
elif command -v xcodegen >/dev/null 2>&1; then
  XCODEGEN_BIN="$(command -v xcodegen)"
else
  XCODEGEN_BIN="$ARTIFACT_DIR/tools/xcodegen/bin/xcodegen"
fi
if [[ ! -x "$XCODEGEN_BIN" ]]; then
  echo 'Install XcodeGen (brew install xcodegen), or set XCODEGEN to its executable path.' >&2
  exit 1
fi
if [[ "$XCODEGEN_BIN" == "$ARTIFACT_DIR/tools/xcodegen/bin/xcodegen" ]]; then
  PRESET_DIR="$ARTIFACT_DIR/tools/xcodegen/share/xcodegen/SettingPresets"
  if [[ ! -f "$PRESET_DIR/Platforms/iOS.yml" || ! -f "$PRESET_DIR/Platforms/macOS.yml" ]]; then
    echo 'The local XcodeGen distribution is incomplete. Restore its share/xcodegen/SettingPresets directory alongside bin/.' >&2
    exit 1
  fi
fi

cleanup() {
  if [[ -n "$BACKUP" && -e "$BACKUP" && ! -e "$DESTINATION" ]]; then
    /bin/mv "$BACKUP" "$DESTINATION" || echo "Previous app remains at $BACKUP" >&2
  fi
  if [[ -n "$STAGING_DIR" && -d "$STAGING_DIR" ]]; then
    /bin/rm -rf "$STAGING_DIR"
  fi
}
trap cleanup EXIT

# Build and verify before touching the installed application.
mkdir -p "$ARTIFACT_DIR"
cd "$APP_DIR"
"$XCODEGEN_BIN" generate
if ! /usr/bin/grep -Eq '^[[:space:]]*SDKROOT = iphoneos;' BayAreaApps.xcodeproj/project.pbxproj \
  || ! /usr/bin/grep -Eq '^[[:space:]]*SDKROOT = macosx;' BayAreaApps.xcodeproj/project.pbxproj; then
  echo 'Generated project is missing the expected iOS or Mac SDK. Check that XcodeGen includes its SettingPresets resources.' >&2
  exit 1
fi
xcodebuild -project BayAreaApps.xcodeproj -scheme BayAreaAppsMac -configuration Release \
  -destination 'platform=macOS' -derivedDataPath build/mac \
  CODE_SIGN_IDENTITY=- CODE_SIGNING_REQUIRED=NO build 2>&1 | tee "$ARTIFACT_DIR/mac-build.log"
BUILT_APP="$APP_DIR/build/mac/Build/Products/Release/$APP_NAME.app"
/usr/bin/codesign --verify --deep --strict "$BUILT_APP"
BUILT_ID="$(/usr/libexec/PlistBuddy -c 'Print :CFBundleIdentifier' "$BUILT_APP/Contents/Info.plist")"
if [[ "$BUILT_ID" != "$BUNDLE_ID" ]]; then
  echo "Unexpected built app identity: $BUILT_ID" >&2
  exit 1
fi

# Stage a complete copy next to the destination for the final rename.
mkdir -p "$HOME/Applications"
STAGING_DIR="$(mktemp -d "$HOME/Applications/.BayAreaApps-install.XXXXXX")"
STAGED_APP="$STAGING_DIR/$APP_NAME.app"
/usr/bin/ditto "$BUILT_APP" "$STAGED_APP"
/usr/bin/codesign --verify --deep --strict "$STAGED_APP"
if [[ -e "$DESTINATION" ]]; then
  if [[ -L "$DESTINATION" || ! -f "$DESTINATION/Contents/Info.plist" ]]; then
    echo "Refusing to replace an unexpected destination: $DESTINATION" >&2
    exit 1
  fi
  INSTALLED_ID="$(/usr/libexec/PlistBuddy -c 'Print :CFBundleIdentifier' "$DESTINATION/Contents/Info.plist")"
  if [[ "$INSTALLED_ID" != "$BUNDLE_ID" ]]; then
    echo "Refusing to replace a different application: $INSTALLED_ID" >&2
    exit 1
  fi
fi

installed_pids() {
  local process_id command_path
  while IFS= read -r process_id; do
    [[ -n "$process_id" ]] || continue
    command_path="$(/bin/ps -p "$process_id" -o comm= 2>/dev/null | /usr/bin/sed 's/^[[:space:]]*//' || true)"
    if [[ "$command_path" == "$APP_BINARY" ]]; then
      echo "$process_id"
    fi
  done < <(/usr/bin/pgrep -x "$APP_NAME" || true)
}

# Do not stop another checkout, another user's copy, or a similarly named app.
RUNNING_PIDS="$(installed_pids)"
if [[ -n "$RUNNING_PIDS" ]]; then
  while IFS= read -r process_id; do
    /bin/kill -TERM "$process_id" 2>/dev/null || true
  done <<< "$RUNNING_PIDS"
  for _ in {1..50}; do
    [[ -z "$(installed_pids)" ]] && break
    /bin/sleep 0.1
  done
  if [[ -n "$(installed_pids)" ]]; then
    echo 'The installed app did not close. Installation was left unchanged.' >&2
    exit 1
  fi
fi

if [[ -e "$DESTINATION" ]]; then
  mkdir -p "$ARTIFACT_DIR/backups"
  BACKUP_DIR="$(mktemp -d "$ARTIFACT_DIR/backups/Bay-Area-Apps-$(date '+%Y%m%d-%H%M%S').XXXXXX")"
  BACKUP="$BACKUP_DIR/$APP_NAME.app"
  /bin/mv "$DESTINATION" "$BACKUP"
fi
if ! /bin/mv "$STAGED_APP" "$DESTINATION"; then
  if [[ -n "$BACKUP" && ! -e "$DESTINATION" ]]; then
    /bin/mv "$BACKUP" "$DESTINATION"
  fi
  echo 'Installation failed; the previous app was restored when available.' >&2
  exit 1
fi

VERSION="$(/usr/libexec/PlistBuddy -c 'Print :CFBundleShortVersionString' "$DESTINATION/Contents/Info.plist")"
BUILD="$(/usr/libexec/PlistBuddy -c 'Print :CFBundleVersion' "$DESTINATION/Contents/Info.plist")"
echo "Installed $APP_NAME $VERSION ($BUILD) at $DESTINATION"
if [[ -n "$BACKUP" ]]; then
  echo "Previous app saved at $BACKUP"
fi

case "$MODE" in
  --debug|debug)
    /usr/bin/lldb -- "$APP_BINARY"
    ;;
  --logs|logs)
    /usr/bin/open -n "$DESTINATION"
    /usr/bin/log stream --info --style compact --predicate "process == \"$APP_NAME\""
    ;;
  --telemetry|telemetry)
    /usr/bin/open -n "$DESTINATION"
    /usr/bin/log stream --info --style compact --predicate "subsystem == \"$BUNDLE_ID\""
    ;;
  --verify|verify)
    /usr/bin/open -n "$DESTINATION"
    for _ in {1..50}; do
      [[ -n "$(installed_pids)" ]] && break
      /bin/sleep 0.1
    done
    if [[ -z "$(installed_pids)" ]]; then
      echo 'The app installed, but its process could not be confirmed at the installed path.' >&2
      exit 1
    fi
    echo "Verified installed process: $(installed_pids | /usr/bin/tr '\n' ' ')"
    ;;
  *) /usr/bin/open -n "$DESTINATION" ;;
esac
