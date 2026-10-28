"use client";

// The Mac app opens this page in the default browser for Google sign-in (Google blocks it inside
// the app's web view). After signing in, it hands the Google ID token back to the app through
// litecast://auth along with the app's one-time state, and the app signs in to Firebase with it.

import { useState, useSyncExternalStore } from "react";
import { GoogleAuthProvider, signInWithPopup } from "firebase/auth";
import { LogIn } from "lucide-react";
import { auth, googleProvider } from "@/lib/firebase";

const noSubscribe = () => () => {};
const STATE_PATTERN = /^[A-Za-z0-9_-]{16,128}$/;

function readState() {
  const state = new URLSearchParams(window.location.search).get("state");
  return state && STATE_PATTERN.test(state) ? state : null;
}

export default function DesktopSignInPage() {
  // undefined during server render, null when the link is missing or malformed
  const state = useSyncExternalStore(noSubscribe, readState, () => undefined);
  const [status, setStatus] = useState<"idle" | "working" | "done" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  const signIn = async () => {
    if (!state || !auth || !googleProvider) return;
    setStatus("working");
    setError(null);
    try {
      const result = await signInWithPopup(auth, googleProvider);
      const idToken = GoogleAuthProvider.credentialFromResult(result)?.idToken;
      if (!idToken) throw new Error("Google didn't return a sign-in token");
      const params = new URLSearchParams({ state, idToken });
      window.location.href = `litecast://auth?${params}`;
      setStatus("done");
    } catch (e) {
      setStatus("error");
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  return (
    <div className="p-8 max-w-md mx-auto mt-16 text-center">
      <h1 className="text-2xl font-bold mb-3 text-light-text dark:text-white">Sign in to the LiteCast Mac app</h1>
      {state === null ? (
        <p className="text-gray-600 dark:text-zinc-400">
          This link has expired. Choose Sign in with Google in the LiteCast app to start again.
        </p>
      ) : status === "done" ? (
        <p className="text-gray-600 dark:text-zinc-400">
          You&apos;re signed in. Switch back to LiteCast; you can close this tab.
        </p>
      ) : (
        <>
          <p className="text-gray-600 dark:text-zinc-400 mb-6">
            Sign in with Google here and LiteCast will pick it up.
          </p>
          <button
            onClick={signIn}
            disabled={status === "working" || state === undefined}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-light-primary dark:bg-sky-600 text-white font-medium hover:opacity-90 disabled:opacity-50 transition-opacity"
          >
            <LogIn className="w-5 h-5" />
            {status === "working" ? "Signing in…" : "Sign in with Google"}
          </button>
          {error && <p className="mt-4 text-sm text-red-500">{error}</p>}
        </>
      )}
    </div>
  );
}
