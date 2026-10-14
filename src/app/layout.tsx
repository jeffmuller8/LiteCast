import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Sidebar } from "@/components/sidebar";
import { MobileNav } from "@/components/mobile-nav";
import { MiniPlayer } from "@/components/mini-player";
import { PlayerProvider } from "@/lib/player-context";
import { SubscriptionProvider } from "@/lib/subscription-context";
import { ToastProvider } from "@/components/toast";
import { AuthProvider } from "@/lib/auth-context";
import { ThemeProvider } from "@/lib/theme-context";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "LiteCast - Podcast Player",
  description: "A lightweight podcast player",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className={`${inter.className} bg-light-bg text-light-text dark:bg-zinc-950 dark:text-white`}>
        <ThemeProvider>
        <AuthProvider>
          <SubscriptionProvider>
            <PlayerProvider>
              <ToastProvider>
                <div className="flex h-screen">
                  {/* Desktop Sidebar - hidden on mobile */}
                  <div className="hidden md:flex h-full">
                    <Sidebar />
                  </div>
                  <div className="flex-1 flex flex-col overflow-hidden">
                    {/* Add bottom padding on mobile for nav + mini-player */}
                    <main className="flex-1 overflow-y-auto pb-32 md:pb-0">{children}</main>
                    <MiniPlayer />
                  </div>
                  {/* Mobile Bottom Nav */}
                  <MobileNav />
                </div>
              </ToastProvider>
            </PlayerProvider>
          </SubscriptionProvider>
        </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
