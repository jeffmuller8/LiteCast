"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { Home, Search, Library, Bookmark, Settings, LogOut, User, X } from "lucide-react";
import { useAuth } from "@/lib/auth-context";

const navItems = [
  { href: "/", icon: Home, label: "Home" },
  { href: "/library", icon: Library, label: "Library" },
  { href: "/bookmarks", icon: Bookmark, label: "Bookmarks" },
  { href: "/search", icon: Search, label: "Search" },
];

export function MobileNav() {
  const pathname = usePathname();
  const { user, signInWithGoogle, signOut } = useAuth();
  const [showMenu, setShowMenu] = useState(false);

  return (
    <>
      {/* Full Screen Account Overlay */}
      {showMenu && (
        <div className="md:hidden fixed inset-0 z-50 bg-light-bg dark:bg-zinc-950 animate-fadeIn">
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-zinc-800">
            <h1 className="text-xl font-bold text-light-text dark:text-white">{user ? "Account" : "Menu"}</h1>
            <button
              onClick={() => setShowMenu(false)}
              className="p-2 text-gray-500 dark:text-zinc-400 hover:text-light-text dark:hover:text-white transition-colors"
            >
              <X className="w-6 h-6" />
            </button>
          </div>

          {/* User Info */}
          {user && (
            <div className="flex items-center gap-4 p-6 border-b border-gray-200 dark:border-zinc-800">
              {user.photoURL ? (
                <Image
                  src={user.photoURL}
                  alt={user.displayName || "User"}
                  width={64}
                  height={64}
                  className="rounded-full"
                />
              ) : (
                <div className="w-16 h-16 rounded-full bg-light-primary dark:bg-sky-600 flex items-center justify-center text-white text-2xl font-medium">
                  {user.displayName?.charAt(0) || user.email?.charAt(0) || "U"}
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="text-lg font-semibold text-light-text dark:text-white truncate">{user.displayName}</p>
                <p className="text-sm text-gray-500 dark:text-zinc-400 truncate">{user.email}</p>
              </div>
            </div>
          )}

          {/* Menu Items */}
          <div className="p-4 space-y-2">
            <Link
              href="/settings"
              onClick={() => setShowMenu(false)}
              className="flex items-center gap-4 p-4 rounded-xl bg-light-surface dark:bg-zinc-900 text-light-text dark:text-white hover:bg-gray-100 dark:hover:bg-zinc-800 transition-colors"
            >
              <Settings className="w-6 h-6 text-gray-500 dark:text-zinc-400" />
              <span className="font-medium">Settings</span>
            </Link>

            {user ? (
              <button
                onClick={() => {
                  signOut();
                  setShowMenu(false);
                }}
                className="flex items-center gap-4 p-4 rounded-xl w-full text-left bg-light-surface dark:bg-zinc-900 text-red-600 dark:text-red-400 hover:bg-gray-100 dark:hover:bg-zinc-800 transition-colors"
              >
                <LogOut className="w-6 h-6" />
                <span className="font-medium">Sign Out</span>
              </button>
            ) : (
              <button
                onClick={() => {
                  signInWithGoogle();
                  setShowMenu(false);
                }}
                className="flex items-center gap-4 p-4 rounded-xl w-full text-left bg-light-surface dark:bg-zinc-900 text-light-primary dark:text-sky-400 hover:bg-gray-100 dark:hover:bg-zinc-800 transition-colors"
              >
                <User className="w-6 h-6" />
                <span className="font-medium">Sign In with Google</span>
              </button>
            )}
          </div>
        </div>
      )}

      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-light-surface dark:bg-zinc-900 border-t border-gray-200 dark:border-zinc-800 safe-area-bottom">
        <div className="flex items-center justify-around h-16">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href ||
              (item.href === "/library" && pathname.startsWith("/podcast/"));

            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex flex-col items-center justify-center flex-1 h-full transition-colors ${
                  isActive
                    ? "text-light-primary dark:text-sky-400"
                    : "text-gray-500 dark:text-zinc-500"
                }`}
              >
                <Icon className="w-6 h-6" />
                <span className="text-xs mt-1 font-medium">{item.label}</span>
              </Link>
            );
          })}

          {/* User Avatar / Menu Button */}
          <button
            onClick={() => setShowMenu(!showMenu)}
            className="flex flex-col items-center justify-center flex-1 h-full transition-colors text-gray-500 dark:text-zinc-500"
          >
            {user?.photoURL ? (
              <Image
                src={user.photoURL}
                alt={user.displayName || "User"}
                width={28}
                height={28}
                className="rounded-full"
              />
            ) : user ? (
              <div className="w-7 h-7 rounded-full bg-light-primary dark:bg-sky-600 flex items-center justify-center text-white text-sm font-medium">
                {user.displayName?.charAt(0) || user.email?.charAt(0) || "U"}
              </div>
            ) : (
              <User className="w-6 h-6" />
            )}
            <span className="text-xs mt-1 font-medium">{user ? "Account" : "More"}</span>
          </button>
        </div>
      </nav>
    </>
  );
}
