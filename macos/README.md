# LiteCast for macOS

A small native Swift app (no Xcode project needed) that shows the deployed web app in a
WKWebView, so every screen is the web UI, like the Android app. Two pieces are native:

- **Playback**: `AudioPlayer.swift` plays episodes with AVPlayer and publishes them to Now
  Playing, so the media keys, AirPods/headphone buttons and Control Center work (play/pause,
  back 10s, forward 30s, scrubbing, artwork). The page reaches it through `window.LiteCastMac`
  (`WebBridge.swift`); `src/lib/native-bridge.ts` wraps that in the same plugin shape as the
  Android app, so `native-audio.ts` and `player-context.tsx` drive both the same way.
- **Google sign-in**: Google blocks sign-in inside embedded web views, so `AuthBridge.swift`
  opens `/desktop-sign-in` in the default browser. That page signs in with Google and sends the
  Google ID token back through `litecast://auth`, with a one-time `state` so no other page can
  sign the app in to a different account. The app then signs in to Firebase with it.

Closing the window hides it and playback continues; click the Dock icon to bring it back, and
quit with ⌘Q. Web changes reach the app once they're deployed to Vercel.

## Build

```bash
npm run mac:app
```

Produces `macos/build/LiteCast.app` and `macos/build/LiteCast.dmg` (universal, ad-hoc signed).
Only the Xcode command-line tools are needed. To try local web changes in the app, build it
against the dev server: `LITECAST_URL=http://localhost:3000 macos/build.sh`.

The icon (`AppIcon.icns`) is rendered from `website/logo-sticker.svg` by
`scripts/make-icon.swift`; delete it and rebuild to regenerate.

## Signing

The app is ad-hoc signed, not notarized, so macOS blocks it the first time it's opened from a
download: open it once, then System Settings → Privacy & Security → **Open Anyway**. Notarizing
needs an Apple Developer ID (Apple Developer Program); with one, sign with
`codesign --options runtime --sign "Developer ID Application: …"` and submit the DMG with
`xcrun notarytool` (which needs full Xcode).
