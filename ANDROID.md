# Cast Lite for Android

The Android app is a Capacitor shell around the deployed web app (`server.url` in
`capacitor.config.json` points at https://app.castlite.app), so every screen is the
web UI. Two pieces are native:

- **Playback**: `PlaybackService` (Media3 ExoPlayer in a foreground `MediaSessionService`) plays
  episodes, so audio keeps going with the screen off or another app open. It draws the
  notification and lock-screen controls (play/pause, back 10s, forward 30s, seek bar, artwork).
  `LiteCastAudioPlugin` bridges it to `src/lib/native-audio.ts`, which `player-context.tsx`
  uses in place of HTML5 audio when it runs in the app. Progress saving, In Progress, resume
  and the queue stay in the web code.
- **Google sign-in**: Google blocks its sign-in page inside WebViews, so `LiteCastAuthPlugin`
  signs in with Android's Credential Manager and `auth-context.tsx` hands the ID token to
  Firebase (`signInWithCredential`). Same Firebase user and Firestore doc as the web.

Browsers never load any of this: both paths check `Capacitor.isNativePlatform()`.

Because the app loads the live site, **web changes (including the native player wiring) reach
the app only once they're deployed to Vercel**. Native changes (anything under `android/` or
`capacitor.config.json`) need a new APK.

## Build the debug APK

Requirements (already installed on this Mac): JDK 21 (`brew install openjdk@21`) and the
Android SDK at `~/Library/Android/sdk` (`brew install --cask android-commandlinetools`, then
`sdkmanager "platform-tools" "platforms;android-36" "build-tools;36.0.0"`).
`android/local.properties` points Gradle at the SDK and isn't committed.

```bash
npm run android:apk
```

The APK lands at `android/app/build/outputs/apk/debug/app-debug.apk`.

## One-time setup for Google sign-in

1. Firebase console → project **litecast-c7d80** → Project settings → General → **Add app** →
   Android. Package name `com.litecast.app`, nickname Cast Lite Android, and the debug SHA-1
   below. Download of `google-services.json` isn't needed; skip that step.
2. Get the SHA-1 of this Mac's debug key (the APK is signed with it):

   ```bash
   /opt/homebrew/opt/openjdk@21/bin/keytool -list -v -keystore ~/.android/debug.keystore -alias androiddebugkey -storepass android | grep SHA1
   ```

3. Firebase console → Authentication → Sign-in method → Google → **Web SDK configuration** →
   copy the **Web client ID** (ends in `.apps.googleusercontent.com`) into
   `capacitor.config.json` at `plugins.LiteCastAuth.webClientId`, then rebuild the APK.

A release build signed with a different key needs its own SHA-1 added the same way.

## Install on the phone

Either copy the APK to the phone and open it (allow "Install unknown apps" for the app you
open it with), or with USB debugging on:

```bash
~/Library/Android/sdk/platform-tools/adb install -r android/app/build/outputs/apk/debug/app-debug.apk
```

## Checking background playback

Settings → Playback log works in the app too. With the native player you'll see `load`,
`play`, `waiting`/`playing`, and a `heartbeat` every 30s while the app is in the background.
Gaps in heartbeats with the position still advancing mean the page was paused but audio kept
playing; the position is caught up and saved when you return to the app.
