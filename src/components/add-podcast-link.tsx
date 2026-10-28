"use client";

import { useEffect, useState } from "react";
import { Link2, Loader2, Lock, X } from "lucide-react";
import { useSubscriptions } from "@/lib/subscription-context";
import { useToast } from "@/components/toast";

// "Add podcast link": subscribe to a private / generated feed link (Patreon, Supercast,
// Substack...). These are marked private so the link is only ever read directly and
// never sent to Podcast Index.
export function AddPodcastLinkButton({ className = "" }: { className?: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className={`flex items-center gap-2 px-3 py-1.5 text-sm font-medium rounded-lg border border-light-primary dark:border-sky-500 text-light-primary dark:text-sky-400 hover:bg-light-primary/10 dark:hover:bg-sky-500/10 transition-colors ${className}`}
      >
        <Link2 className="w-4 h-4" />
        Add podcast link
      </button>
      {open && <AddPodcastLinkDialog onClose={() => setOpen(false)} />}
    </>
  );
}

function AddPodcastLinkDialog({ onClose }: { onClose: () => void }) {
  const { subscribe, isSubscribed } = useSubscriptions();
  const { showToast } = useToast();
  const [link, setLink] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !busy) onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [busy, onClose]);

  const add = async () => {
    const feedUrl = link.trim();
    if (!feedUrl) return;
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(`/api/feed?url=${encodeURIComponent(feedUrl)}&private=1`);
      const data = await response.json();
      if (data.error || !data.podcast) {
        setError(data.error || "Couldn't read a podcast from that link");
        return;
      }

      const { podcast } = data;
      if (isSubscribed(podcast.id)) {
        showToast(`${podcast.title} is already in your library`);
        onClose();
        return;
      }

      const ok = await subscribe(
        {
          id: podcast.id,
          title: podcast.title,
          author: podcast.author,
          description: podcast.description,
          artworkUrl: podcast.image,
          feedUrl,
          isPrivate: true,
        },
        feedUrl
      );
      if (!ok) {
        setError("Found the podcast, but couldn't load its episodes");
        return;
      }
      showToast(`Added ${podcast.title}`);
      onClose();
    } catch {
      setError("Couldn't reach that link");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 animate-fadeIn" onClick={() => !busy && onClose()} />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="add-link-title"
        className="relative w-full max-w-md bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-2xl shadow-2xl p-6 animate-fadeIn"
      >
        <button
          onClick={onClose}
          disabled={busy}
          aria-label="Close"
          className="absolute top-4 right-4 p-1 text-gray-400 dark:text-zinc-500 hover:text-light-primary dark:hover:text-sky-400 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        <h2 id="add-link-title" className="text-lg font-semibold text-light-text dark:text-white">
          Add podcast link
        </h2>
        <p className="text-sm text-gray-500 dark:text-zinc-400 mt-1">
          Paste the private or generated feed link a podcast gave you (Patreon, Supercast, Substack and similar).
        </p>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            add();
          }}
          className="mt-4"
        >
          <input
            type="url"
            inputMode="url"
            autoFocus
            autoCapitalize="off"
            autoCorrect="off"
            spellCheck={false}
            placeholder="https://..."
            value={link}
            onChange={(e) => setLink(e.target.value)}
            disabled={busy}
            className="w-full px-3 py-2.5 text-sm rounded-lg bg-light-surface dark:bg-zinc-800 border border-gray-300 dark:border-zinc-700 text-light-text dark:text-white placeholder:text-gray-400 dark:placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-light-primary dark:focus:ring-sky-500"
          />
          {error && <p className="text-sm text-red-500 mt-2">{error}</p>}

          <p className="flex items-start gap-2 text-xs text-gray-400 dark:text-zinc-500 mt-3">
            <Lock className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
            The link stays private: it&apos;s only used to read the feed and isn&apos;t shared or sent to podcast directories.
          </p>

          <div className="flex justify-end gap-3 mt-5">
            <button
              type="button"
              onClick={onClose}
              disabled={busy}
              className="px-4 py-2 text-sm font-medium rounded-lg text-gray-600 dark:text-zinc-300 hover:text-light-primary dark:hover:text-sky-400 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={busy || !link.trim()}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg bg-light-primary dark:bg-sky-600 text-white hover:bg-light-primary/90 dark:hover:bg-sky-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {busy && <Loader2 className="w-4 h-4 animate-spin" />}
              {busy ? "Adding..." : "Add"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
