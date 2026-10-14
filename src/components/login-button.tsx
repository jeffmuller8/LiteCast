"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { LogIn, LogOut, Settings } from "lucide-react";

export function LoginButton() {
  const { user, loading, signInWithGoogle, signOut } = useAuth();
  const pathname = usePathname();
  const isSettingsActive = pathname === "/settings";

  if (loading) {
    return (
      <div className="flex items-center gap-3 px-3 py-2.5">
        <div className="w-8 h-8 rounded-full bg-gray-300 dark:bg-zinc-700 animate-pulse" />
        <div className="flex-1">
          <div className="h-4 w-20 bg-gray-300 dark:bg-zinc-700 rounded animate-pulse" />
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
            <div className="w-8 h-8 rounded-full bg-light-primary dark:bg-sky-600 flex items-center justify-center text-sm font-medium text-white">
              {user.displayName?.charAt(0) || user.email?.charAt(0) || "U"}
            </div>
          )}
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-light-text dark:text-white truncate">
              {user.displayName}
            </p>
            <p className="text-xs text-gray-500 dark:text-zinc-400 truncate">
              {user.email}
            </p>
          </div>
        </div>
        <Link
          href="/settings"
          className="relative flex items-center gap-3 px-3 py-2 w-full rounded-lg transition-colors text-sm group"
        >
          {/* Animated background fill with rounded corners */}
          <div
            className={`absolute inset-0 rounded-lg bg-light-primary/25 dark:bg-sky-500/25 border border-light-primary dark:border-sky-500 transition-all duration-300 ease-out ${
              isSettingsActive ? "opacity-100 scale-100" : "opacity-0 scale-95"
            }`}
          />
          <span className={`relative z-10 transition-colors duration-200 ${
            isSettingsActive
              ? "text-light-primary dark:text-sky-400"
              : "text-gray-600 dark:text-zinc-400 group-hover:text-light-text dark:group-hover:text-white"
          }`}>
            <Settings className="w-4 h-4" />
          </span>
          <span className={`relative z-10 transition-colors duration-200 ${
            isSettingsActive
              ? "text-light-primary dark:text-sky-400"
              : "text-gray-600 dark:text-zinc-400 group-hover:text-light-text dark:group-hover:text-white"
          }`}>
            Settings
          </span>
        </Link>
        <button
          onClick={() => signOut()}
          className="flex items-center gap-3 px-3 py-2 w-full text-left text-gray-600 dark:text-zinc-400 hover:text-light-text dark:hover:text-white hover:bg-gray-200 dark:hover:bg-zinc-800 rounded-lg transition-colors text-sm"
        >
          <LogOut className="w-4 h-4" />
          Sign out
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-1">
      <Link
        href="/settings"
        className="relative flex items-center gap-3 px-3 py-2.5 w-full rounded-lg transition-colors group"
      >
        {/* Animated background fill with rounded corners */}
        <div
          className={`absolute inset-0 rounded-lg bg-light-primary/25 dark:bg-sky-500/25 border border-light-primary dark:border-sky-500 transition-all duration-300 ease-out ${
            isSettingsActive ? "opacity-100 scale-100" : "opacity-0 scale-95"
          }`}
        />
        <span className={`relative z-10 transition-colors duration-200 ${
          isSettingsActive
            ? "text-light-primary dark:text-sky-400"
            : "text-gray-600 dark:text-zinc-400 group-hover:text-light-text dark:group-hover:text-white"
        }`}>
          <Settings className="w-5 h-5" />
        </span>
        <span className={`relative z-10 transition-colors duration-200 ${
          isSettingsActive
            ? "text-light-primary dark:text-sky-400"
            : "text-gray-600 dark:text-zinc-400 group-hover:text-light-text dark:group-hover:text-white"
        }`}>
          Settings
        </span>
      </Link>
      <button
        onClick={() => signInWithGoogle()}
        className="flex items-center gap-3 px-3 py-2.5 w-full text-left text-gray-600 dark:text-zinc-400 hover:text-light-text dark:hover:text-white hover:bg-gray-200 dark:hover:bg-zinc-800 rounded-lg transition-colors"
      >
        <LogIn className="w-5 h-5" />
        Sign in with Google
      </button>
    </div>
  );
}
