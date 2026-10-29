#!/bin/bash
# Builds "Cast Lite.app" (universal, ad-hoc signed) and CastLite.dmg into macos/build.
# Needs only the Xcode command-line tools. To test local web changes, point the app at the dev
# server: LITECAST_URL=http://localhost:3000 macos/build.sh
set -euo pipefail
cd "$(dirname "$0")"

OUT=build
APP="$OUT/Cast Lite.app"
DMG="$OUT/CastLite.dmg"
rm -rf "$APP" "$OUT/dmg" "$DMG"
mkdir -p "$APP/Contents/MacOS" "$APP/Contents/Resources"

if [ ! -f AppIcon.icns ]; then
  swift scripts/make-icon.swift ../website/logo-sticker.svg "$OUT/AppIcon.iconset"
  iconutil -c icns "$OUT/AppIcon.iconset" -o AppIcon.icns
fi

for arch in arm64 x86_64; do
  swiftc -O -target "$arch-apple-macos13.0" -o "$OUT/LiteCast-$arch" Sources/*.swift
done
lipo -create -output "$APP/Contents/MacOS/LiteCast" "$OUT/LiteCast-arm64" "$OUT/LiteCast-x86_64"

cp Info.plist "$APP/Contents/Info.plist"
cp AppIcon.icns "$APP/Contents/Resources/AppIcon.icns"
if [ -n "${LITECAST_URL:-}" ]; then
  /usr/libexec/PlistBuddy -c "Set :LiteCastURL $LITECAST_URL" "$APP/Contents/Info.plist"
fi

# Ad-hoc signature: required to run on Apple Silicon. Not notarized (needs a Developer ID).
codesign --force --sign - "$APP"

mkdir -p "$OUT/dmg"
cp -R "$APP" "$OUT/dmg/"
ln -s /Applications "$OUT/dmg/Applications"
hdiutil create -quiet -volname "Cast Lite" -srcfolder "$OUT/dmg" -ov -format UDZO "$DMG"
rm -rf "$OUT/dmg"

echo "Built $PWD/$APP and $PWD/$DMG"
