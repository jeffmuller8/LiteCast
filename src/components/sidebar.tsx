"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Search, Download, Radio, Library, Bookmark, Settings } from "lucide-react";
import { LoginButton } from "@/components/login-button";

const navItems = [
  { href: "/", icon: Home, label: "Home" },
  { href: "/library", icon: Library, label: "Podcast Library" },
  { href: "/bookmarks", icon: Bookmark, label: "Bookmarks" },
  { href: "/search", icon: Search, label: "Search" },
  { href: "/downloads", icon: Download, label: "Downloads" },
  { href: "/settings", icon: Settings, label: "Settings" },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-64 bg-zinc-900 border-r border-zinc-800 flex flex-col">
      <div className="p-6">
        <Link href="/" className="flex items-center gap-2 text-xl font-bold text-white">
          <Radio className="w-6 h-6 text-purple-500" />
          LiteCast
        </Link>
      </div>

      <nav className="flex-1 px-3">
        <ul className="space-y-1">
          {navItems.map((item) => {
            const isActive = pathname === item.href;
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors ${
                    isActive
                      ? "bg-purple-600 text-white"
                      : "text-zinc-400 hover:text-white hover:bg-zinc-800"
                  }`}
                >
                  <item.icon className="w-5 h-5" />
                  {item.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="p-4 border-t border-zinc-800">
        <LoginButton />
      </div>
      <div className="px-4 pb-4">
        <p className="text-xs text-zinc-500">LiteCast v1.0.0</p>
      </div>
    </aside>
  );
}
