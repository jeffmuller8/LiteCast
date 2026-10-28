"use client";

import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import {
  User,
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithCredential,
  signInWithPopup,
  signOut as firebaseSignOut,
} from "firebase/auth";
import { auth, googleProvider } from "./firebase";
import { hasNativeAuth, nativeGoogleSignIn, nativeSignOut } from "./native-auth";

interface AuthContextType {
  user: User | null;
  loading: boolean;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // If Firebase auth is not configured, just mark as not loading
    if (!auth) {
      setLoading(false);
      return;
    }

    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUser(user);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const signInWithGoogle = async () => {
    if (!auth || !googleProvider) {
      console.warn("Firebase auth not configured");
      return;
    }
    try {
      if (hasNativeAuth()) {
        // Google blocks its sign-in page in the Android app's WebView; sign in natively instead
        const idToken = await nativeGoogleSignIn();
        if (!idToken) return; // Cancelled
        await signInWithCredential(auth, GoogleAuthProvider.credential(idToken));
      } else {
        await signInWithPopup(auth, googleProvider);
      }
    } catch (error) {
      console.error("Error signing in with Google:", error);
      throw error;
    }
  };

  const signOut = async () => {
    if (!auth) {
      console.warn("Firebase auth not configured");
      return;
    }
    try {
      await firebaseSignOut(auth);
      if (hasNativeAuth()) await nativeSignOut();
    } catch (error) {
      console.error("Error signing out:", error);
      throw error;
    }
  };

  return (
    <AuthContext.Provider value={{ user, loading, signInWithGoogle, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
