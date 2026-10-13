"use client";

import { Bookmark } from "lucide-react";
import { EpisodeItem } from "@/components/episode-item";
import { useSubscriptions } from "@/lib/subscription-context";
import Link from "next/link";

export default function BookmarksPage() {
  const { getBookmarkedEpisodes, isHydrated } = useSubscriptions();
  const bookmarkedEpisodes = getBookmarkedEpisodes();

  // Show loading while hydrating from localStorage
  if (!isHydrated) {
    return (
      <div className="p-8">
        <div className="animate-pulse">
          <div className="h-8 w-48 bg-zinc-800 rounded mb-6"></div>
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-24 bg-zinc-800 rounded-xl"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8">
      <div className="flex items-center gap-3 mb-6">
        <Bookmark className="w-8 h-8 text-purple-400" />
        <h1 className="text-2xl font-bold">Bookmarks</h1>
        {bookmarkedEpisodes.length > 0 && (
          <span className="text-zinc-400">({bookmarkedEpisodes.length})</span>
        )}
      </div>

      {bookmarkedEpisodes.length > 0 ? (
        <div className="space-y-3">
          {bookmarkedEpisodes.map((episode) => (
            <EpisodeItem
              key={episode.id}
              episode={episode}
              showPodcastInfo
            />
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <Bookmark className="w-16 h-16 text-zinc-700 mb-4" />
          <h2 className="text-xl font-semibold text-zinc-400">
            No bookmarks yet
          </h2>
          <p className="text-zinc-500 mt-2 max-w-md">
            Bookmark episodes you want to listen to later. They&apos;ll stay here even after you&apos;ve played them.
          </p>
          <Link
            href="/"
            className="mt-6 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-500 transition-colors"
          >
            Browse Episodes
          </Link>
        </div>
      )}
    </div>
  );
}
