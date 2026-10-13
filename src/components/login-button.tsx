"use client";

import { useAuth } from "@/lib/auth-context";
import { LogIn, LogOut } from "lucide-react";

export function LoginButton() {
  const { user, loading, signInWithGoogle, signOut } = useAuth();

  if (loading) {
    return (
      <div className="flex items-center gap-3 px-3 py-2.5">
        <div className="w-8 h-8 rounded-full bg-zinc-700 animate-pulse" />
        <div className="flex-1">
          <div className="h-4 w-20 bg-zinc-700 rounded animate-pulse" />
        </div>
      </div>
    );
  }

  if (user) {
    return (
      <div className="space-y-2">
        <div className="flex items-center gap-3 px-3 py-2">
          {user.photoURL ? (
            <img
              src={user.photoURL}
              alt={user.displayName || "User"}
              className="w-8 h-8 rounded-full"
            />
          ) : (
            <div className="w-8 h-8 rounded-full bg-purple-600 flex items-center justify-center text-sm font-medium">
              {user.displayName?.charAt(0) || user.email?.charAt(0) || "U"}
            </div>
          )}
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-white truncate">
              {user.displayName}
            </p>
            <p className="text-xs text-zinc-400 truncate">
              {user.email}
            </p>
          </div>
        </div>
        <button
          onClick={() => signOut()}
          className="flex items-center gap-3 px-3 py-2 w-full text-left text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-lg transition-colors text-sm"
        >
          <LogOut className="w-4 h-4" />
          Sign out
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={() => signInWithGoogle()}
      className="flex items-center gap-3 px-3 py-2.5 w-full text-left text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-lg transition-colors"
    >
      <LogIn className="w-5 h-5" />
      Sign in with Google
    </button>
  );
}
