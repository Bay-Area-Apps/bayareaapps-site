#!/bin/bash
set -euo pipefail
cd "$(dirname "$0")/.."
: "${BAYAREA_DEVICE_ID:?Set BAYAREA_DEVICE_ID to the paired iPhone identifier from xcrun devicectl list devices.}"
./scripts/build-ios.sh
xcrun devicectl device install app --device "$BAYAREA_DEVICE_ID" \
  'build/ios-device/Build/Products/Debug-iphoneos/Bay Area Apps.app'
echo 'Installed Bay Area Apps. No tests or automated UI actions were run on the iPhone.'
