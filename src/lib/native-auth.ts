// Google sign-in for the Android app (android/.../LiteCastAuthPlugin.java) and the Mac app
// (macos/Sources/AuthBridge.swift, via the browser and /desktop-sign-in), each returning a
// Google ID token for Firebase. Browsers keep using the Firebase popup.

import { Capacitor, registerPlugin } from "@capacitor/core";
import { hasMacPlugin, macPlugin } from "./native-bridge";

interface LiteCastAuthPlugin {
  signInWithGoogle(): Promise<{ idToken: string }>;
  signOut(): Promise<void>;
}

const LiteCastAuth = hasMacPlugin("LiteCastAuth")
  ? macPlugin<LiteCastAuthPlugin>("LiteCastAuth")
  : registerPlugin<LiteCastAuthPlugin>("LiteCastAuth");

export function hasNativeAuth() {
  return hasMacPlugin("LiteCastAuth") || (Capacitor.isNativePlatform() && Capacitor.isPluginAvailable("LiteCastAuth"));
}

/** The Google ID token, or null if the user closed the account picker. */
export async function nativeGoogleSignIn(): Promise<string | null> {
  try {
    const { idToken } = await LiteCastAuth.signInWithGoogle();
    return idToken;
  } catch (e) {
    // Android rejects with code CANCELLED; the Mac bridge rejects with that message
    if ((e as { code?: string }).code === "CANCELLED" || (e as Error).message === "CANCELLED") return null;
    throw e;
  }
}

export async function nativeSignOut() {
  await LiteCastAuth.signOut().catch(() => {});
}
