"use client";

import { useRef, useState } from "react";
import { Settings, Upload, Download, FileText, Check, AlertCircle, Sun, Moon } from "lucide-react";
import { useSubscriptions } from "@/lib/subscription-context";
import { useToast } from "@/components/toast";
import { useTheme } from "@/lib/theme-context";
import { usePlayer } from "@/lib/player-context";

export default function SettingsPage() {
  const { podcasts, subscribe } = useSubscriptions();
  const { showToast } = useToast();
  const { theme, setTheme } = useTheme();
  const { keepScreenOn, setKeepScreenOn, wakeLockSupported } = usePlayer();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [importStatus, setImportStatus] = useState<{
    total: number;
    imported: number;
    skipped: number;
    failed: number;
  } | null>(null);

  const handleExport = () => {
    if (podcasts.length === 0) {
      showToast("No podcasts to export");
      return;
    }

    // Generate OPML
    const opml = generateOPML(podcasts);

    // Create and download file
    const blob = new Blob([opml], { type: "text/x-opml" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `litecast-subscriptions-${new Date().toISOString().split("T")[0]}.opml`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    showToast(`Exported ${podcasts.length} podcast${podcasts.length === 1 ? "" : "s"}`);
  };

  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsImporting(true);
    setImportStatus(null);

    try {
      const text = await file.text();
      const feeds = parseOPML(text);

      if (feeds.length === 0) {
        showToast("No podcast feeds found in OPML file");
        setIsImporting(false);
        return;
      }

      // Import each feed
      let imported = 0;
      let skipped = 0;
      let failed = 0;

      for (const feed of feeds) {
        // Check if already subscribed
        if (podcasts.some((p) => p.feedUrl === feed.url)) {
          skipped++;
          continue;
        }

        try {
          // Fetch podcast info from Podcast Index by feed URL
          const lookupResponse = await fetch(
            `/api/podcast/byfeedurl?url=${encodeURIComponent(feed.url)}`
          );
          const lookupData = await lookupResponse.json();

          if (lookupData.podcast) {
            await subscribe(lookupData.podcast, feed.url);
            imported++;
          } else {
            // Fallback to OPML data if lookup fails
            await subscribe(
              {
                id: feed.url,
                title: feed.title || "Unknown Podcast",
                author: "",
                description: "",
                artworkUrl: "",
                feedUrl: feed.url,
              },
              feed.url
            );
            imported++;
          }
        } catch (err) {
          console.error("Failed to import feed:", feed.url, err);
          failed++;
        }
      }

      setImportStatus({ total: feeds.length, imported, skipped, failed });
      showToast(`Imported ${imported} podcast${imported === 1 ? "" : "s"}`);
    } catch (err) {
      console.error("Failed to parse OPML:", err);
      showToast("Failed to parse OPML file");
    } finally {
      setIsImporting(false);
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  return (
    <div className="p-8 animate-fadeIn">
      <div className="flex items-center gap-3 mb-8">
        <Settings className="w-8 h-8 text-light-primary dark:text-sky-400" />
        <h1 className="text-2xl font-bold">Settings</h1>
      </div>

      {/* Appearance Section */}
      <section className="max-w-2xl mb-8">
        <h2 className="text-lg font-semibold mb-4">Appearance</h2>
        <div className="bg-light-surface dark:bg-zinc-800/50 rounded-xl p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-light-text dark:text-white">Theme</p>
              <p className="text-sm text-gray-500 dark:text-zinc-400">Choose light or dark mode</p>
            </div>
            <div className="flex items-center bg-gray-200 dark:bg-zinc-900 rounded-lg p-1">
              <button
                onClick={() => setTheme("light")}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm transition-colors ${
                  theme === "light"
                    ? "bg-light-primary dark:bg-sky-600 text-white"
                    : "text-gray-600 dark:text-zinc-400 hover:text-light-text dark:hover:text-white"
                }`}
              >
                <Sun className="w-4 h-4" />
                Light
              </button>
              <button
                onClick={() => setTheme("dark")}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm transition-colors ${
                  theme === "dark"
                    ? "bg-light-primary dark:bg-sky-600 text-white"
                    : "text-gray-600 dark:text-zinc-400 hover:text-light-text dark:hover:text-white"
                }`}
              >
                <Moon className="w-4 h-4" />
                Dark
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Playback Section */}
      <section className="max-w-2xl mb-8">
        <h2 className="text-lg font-semibold mb-4">Playback</h2>
        <div className="bg-light-surface dark:bg-zinc-800/50 rounded-xl p-6">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="font-medium text-light-text dark:text-white">Keep screen on while playing</p>
              <p className="text-sm text-gray-500 dark:text-zinc-400">
                {wakeLockSupported
                  ? "Stops your phone from locking during playback. Uses more battery."
                  : "Not supported in this browser."}
              </p>
            </div>
            <button
              role="switch"
              aria-checked={keepScreenOn}
              aria-label="Keep screen on while playing"
              disabled={!wakeLockSupported}
              onClick={() => setKeepScreenOn(!keepScreenOn)}
              className={`relative inline-flex h-7 w-12 flex-shrink-0 items-center rounded-full transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
                keepScreenOn ? "bg-light-primary dark:bg-sky-600" : "bg-gray-300 dark:bg-zinc-700"
              }`}
            >
              <span
                className={`inline-block h-5 w-5 rounded-full bg-white shadow transition-transform ${
                  keepScreenOn ? "translate-x-6" : "translate-x-1"
                }`}
              />
            </button>
          </div>
        </div>
      </section>

      {/* Import/Export Section */}
      <section className="max-w-2xl">
        <h2 className="text-lg font-semibold mb-4">Import & Export</h2>
        <div className="bg-light-surface dark:bg-zinc-800/50 rounded-xl p-6 space-y-6">
          <p className="text-gray-500 dark:text-zinc-400 text-sm">
            Import or export your podcast subscriptions using OPML format. This is compatible with most podcast apps.
          </p>

          <div className="flex gap-4">
            {/* Export Button */}
            <button
              onClick={handleExport}
              disabled={podcasts.length === 0}
              className="flex items-center gap-2 px-5 py-2.5 bg-light-primary dark:bg-sky-600 text-white rounded-lg font-medium hover:bg-light-primary/90 dark:hover:bg-sky-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Download className="w-5 h-5" />
              Export OPML
            </button>

            {/* Import Button */}
            <button
              onClick={handleImportClick}
              disabled={isImporting}
              className="flex items-center gap-2 px-5 py-2.5 border border-gray-300 dark:border-zinc-600 text-gray-600 dark:text-zinc-300 rounded-lg font-medium hover:border-light-primary dark:hover:border-sky-500 hover:text-light-primary dark:hover:text-sky-400 hover:bg-light-primary/10 dark:hover:bg-sky-500/10 transition-colors disabled:opacity-50"
            >
              <Upload className="w-5 h-5" />
              {isImporting ? "Importing..." : "Import OPML"}
            </button>

            <input
              ref={fileInputRef}
              type="file"
              accept=".opml,.xml"
              onChange={handleFileChange}
              className="hidden"
            />
          </div>

          {/* Current subscription count */}
          <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-zinc-500">
            <FileText className="w-4 h-4" />
            <span>
              {podcasts.length} podcast{podcasts.length === 1 ? "" : "s"} in your library
            </span>
          </div>

          {/* Import Status */}
          {importStatus && (
            <div className="bg-gray-100 dark:bg-zinc-900 rounded-lg p-4 space-y-2">
              <div className="flex items-center gap-2 text-sm">
                <Check className="w-4 h-4 text-green-500 dark:text-green-400" />
                <span className="text-light-text dark:text-zinc-300">
                  Imported: {importStatus.imported}
                </span>
              </div>
              {importStatus.skipped > 0 && (
                <div className="flex items-center gap-2 text-sm">
                  <AlertCircle className="w-4 h-4 text-yellow-500 dark:text-yellow-400" />
                  <span className="text-gray-600 dark:text-zinc-400">
                    Skipped (already subscribed): {importStatus.skipped}
                  </span>
                </div>
              )}
              {importStatus.failed > 0 && (
                <div className="flex items-center gap-2 text-sm">
                  <AlertCircle className="w-4 h-4 text-red-500 dark:text-red-400" />
                  <span className="text-gray-600 dark:text-zinc-400">
                    Failed: {importStatus.failed}
                  </span>
                </div>
              )}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

function generateOPML(podcasts: any[]): string {
  const escapeXml = (str: string) =>
    str
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&apos;");

  const outlines = podcasts
    .map(
      (p) =>
        `      <outline type="rss" text="${escapeXml(p.title)}" title="${escapeXml(p.title)}" xmlUrl="${escapeXml(p.feedUrl)}" />`
    )
    .join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>
<opml version="2.0">
  <head>
    <title>LiteCast Subscriptions</title>
    <dateCreated>${new Date().toUTCString()}</dateCreated>
  </head>
  <body>
    <outline text="Podcasts">
${outlines}
    </outline>
  </body>
</opml>`;
}

function parseOPML(opmlText: string): { url: string; title?: string }[] {
  const feeds: { url: string; title?: string }[] = [];

  // Match all outline elements
  const outlineRegex = /<outline[^>]*>/gi;
  let match;

  while ((match = outlineRegex.exec(opmlText)) !== null) {
    const outline = match[0];

    // Extract xmlUrl (the feed URL)
    const urlMatch = outline.match(/xmlUrl=["']([^"']+)["']/i);
    if (!urlMatch) continue;

    const url = urlMatch[1];

    // Extract title from text or title attribute
    const textMatch = outline.match(/\btext=["']([^"']+)["']/i);
    const titleMatch = outline.match(/\btitle=["']([^"']+)["']/i);
    const title = textMatch?.[1] || titleMatch?.[1];

    if (url && !feeds.some((f) => f.url === url)) {
      feeds.push({ url, title });
    }
  }

  return feeds;
}
