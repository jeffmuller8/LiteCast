// Google sign-in for the Android app (android/.../LiteCastAuthPlugin.java), which returns a
// Google ID token for Firebase. Browsers keep using the Firebase popup.

import { Capacitor, registerPlugin } from "@capacitor/core";

interface LiteCastAuthPlugin {
  signInWithGoogle(): Promise<{ idToken: string }>;
  signOut(): Promise<void>;
}

const LiteCastAuth = registerPlugin<LiteCastAuthPlugin>("LiteCastAuth");

export function hasNativeAuth() {
  return Capacitor.isNativePlatform() && Capacitor.isPluginAvailable("LiteCastAuth");
}

/** The Google ID token, or null if the user closed the account picker. */
export async function nativeGoogleSignIn(): Promise<string | null> {
  try {
    const { idToken } = await LiteCastAuth.signInWithGoogle();
    return idToken;
  } catch (e) {
    if ((e as { code?: string }).code === "CANCELLED") return null;
    throw e;
  }
}

export async function nativeSignOut() {
  await LiteCastAuth.signOut().catch(() => {});
}
