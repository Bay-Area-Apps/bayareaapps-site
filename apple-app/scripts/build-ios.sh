#!/bin/bash
set -euo pipefail
cd "$(dirname "$0")/.."
if [[ "$(uname -s)" != Darwin ]]; then
  echo 'A Mac with Xcode is required.' >&2
  exit 1
fi
if ! command -v xcodegen >/dev/null; then
  echo 'Install XcodeGen first: brew install xcodegen' >&2
  exit 1
fi
xcodegen generate
swift test
if [[ "${1:-}" == simulator ]]; then
  xcodebuild -project BayAreaApps.xcodeproj -scheme BayAreaAppsIOS -configuration Debug \
    -destination 'generic/platform=iOS Simulator' -derivedDataPath build/ios-simulator \
    CODE_SIGNING_ALLOWED=NO build
else
  : "${BAYAREA_DEVELOPMENT_TEAM:?Set BAYAREA_DEVELOPMENT_TEAM to your Apple signing team identifier.}"
  xcodebuild -project BayAreaApps.xcodeproj -scheme BayAreaAppsIOS -configuration Debug \
    -destination 'generic/platform=iOS' -derivedDataPath build/ios-device \
    DEVELOPMENT_TEAM="$BAYAREA_DEVELOPMENT_TEAM" -allowProvisioningUpdates build
  echo 'Device build completed. No tests were run on any physical phone.'
  echo 'To install: xcrun devicectl device install app --device YOUR_DEVICE_ID "build/ios-device/Build/Products/Debug-iphoneos/Bay Area Apps.app"'
fi
