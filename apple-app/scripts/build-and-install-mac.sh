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
xcodebuild -project BayAreaApps.xcodeproj -scheme BayAreaAppsMac -configuration Release \
  -destination 'platform=macOS' -derivedDataPath build/mac \
  CODE_SIGN_IDENTITY=- CODE_SIGNING_REQUIRED=NO build
mkdir -p "$HOME/Applications"
destination="$HOME/Applications/Bay Area Apps.app"
if [[ -e "$destination" ]]; then
  echo "An app already exists at $destination. Move it aside before installing this version." >&2
  exit 1
fi
ditto 'build/mac/Build/Products/Release/Bay Area Apps.app' "$destination"
open "$destination"
echo 'Installed Bay Area Apps in your Applications folder.'
