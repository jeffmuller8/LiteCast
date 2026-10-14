"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, useRef } from "react";
import { Home, Search, Download, Radio, Library, Bookmark } from "lucide-react";
import { LoginButton } from "@/components/login-button";

const navItems = [
  { href: "/", icon: Home, label: "Home" },
  { href: "/library", icon: Library, label: "Podcast Library" },
  { href: "/bookmarks", icon: Bookmark, label: "Bookmarks" },
  { href: "/search", icon: Search, label: "Search" },
  { href: "/downloads", icon: Download, label: "Downloads" },
];

export function Sidebar() {
  const pathname = usePathname();
  const [indicatorStyle, setIndicatorStyle] = useState({ top: 0, height: 0, opacity: 0 });
  const navRef = useRef<HTMLUListElement>(null);
  const itemRefs = useRef<(HTMLLIElement | null)[]>([]);

  // Find active index
  const activeIndex = navItems.findIndex(
    (item) => pathname === item.href || (item.href === "/library" && pathname.startsWith("/podcast/"))
  );

  useEffect(() => {
    if (activeIndex >= 0 && itemRefs.current[activeIndex] && navRef.current) {
      const item = itemRefs.current[activeIndex];
      const nav = navRef.current;
      if (item) {
        const itemRect = item.getBoundingClientRect();
        const navRect = nav.getBoundingClientRect();
        setIndicatorStyle({
          top: itemRect.top - navRect.top,
          height: itemRect.height,
          opacity: 1,
        });
      }
    } else {
      setIndicatorStyle((prev) => ({ ...prev, opacity: 0 }));
    }
  }, [activeIndex, pathname]);

  return (
    <aside className="w-64 m-3 bg-light-surface dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-2xl flex flex-col shadow-[inset_0_2px_8px_rgba(0,0,0,0.08)] dark:shadow-[inset_0_2px_8px_rgba(0,0,0,0.3)]">
      <div className="p-6">
        <Link href="/" className="flex items-center gap-2 text-xl font-bold text-light-text dark:text-white">
          <Radio className="w-6 h-6 text-light-primary dark:text-sky-500" />
          LiteCast
        </Link>
      </div>

      <nav className="flex-1 px-3">
        <ul ref={navRef} className="relative space-y-1">
          {/* Sliding indicator */}
          <div
            className="absolute left-0 right-0 rounded-lg bg-light-primary/25 dark:bg-sky-500/25 border border-light-primary dark:border-sky-500 transition-all duration-300 ease-out pointer-events-none"
            style={{
              top: indicatorStyle.top,
              height: indicatorStyle.height,
              opacity: indicatorStyle.opacity,
            }}
          />

          {navItems.map((item, index) => {
            const Icon = item.icon;
            const isActive = pathname === item.href ||
              (item.href === "/library" && pathname.startsWith("/podcast/"));
            return (
              <li key={item.href} ref={(el) => { itemRefs.current[index] = el; }}>
                <Link
                  href={item.href}
                  className="relative flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors group"
                >
                  <span className={`relative z-10 transition-colors duration-200 ${
                    isActive
                      ? "text-light-primary dark:text-sky-400"
                      : "text-gray-600 dark:text-zinc-400 group-hover:text-light-text dark:group-hover:text-white"
                  }`}>
                    <Icon className="w-5 h-5" />
                  </span>
                  <span className={`relative z-10 transition-colors duration-200 ${
                    isActive
                      ? "text-light-primary dark:text-sky-400"
                      : "text-gray-600 dark:text-zinc-400 group-hover:text-light-text dark:group-hover:text-white"
                  }`}>
                    {item.label}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="p-4 border-t border-gray-200 dark:border-zinc-800">
        <LoginButton />
      </div>
      <div className="px-4 pb-4">
        <p className="text-xs text-gray-400 dark:text-zinc-500">LiteCast v1.0.0</p>
      </div>
    </aside>
  );
}
