import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Sidebar } from "@/components/sidebar";
import { MiniPlayer } from "@/components/mini-player";
import { PlayerProvider } from "@/lib/player-context";
import { SubscriptionProvider } from "@/lib/subscription-context";
import { ToastProvider } from "@/components/toast";
import { AuthProvider } from "@/lib/auth-context";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "LiteCast - Podcast Player",
  description: "A lightweight podcast player",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className={`${inter.className} bg-zinc-950 text-white`}>
        <AuthProvider>
          <SubscriptionProvider>
            <PlayerProvider>
              <ToastProvider>
                <div className="flex h-screen">
                  <Sidebar />
                  <div className="flex-1 flex flex-col overflow-hidden">
                    <main className="flex-1 overflow-y-auto">{children}</main>
                    <MiniPlayer />
                  </div>
                </div>
              </ToastProvider>
            </PlayerProvider>
          </SubscriptionProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
