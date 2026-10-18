"use client";

import { PodcastCard } from "@/components/podcast-card";
import { useSubscriptions } from "@/lib/subscription-context";
import { Library, Loader2 } from "lucide-react";

export default function LibraryPage() {
  const { podcasts, isHydrated, getNewEpisodeCount } = useSubscriptions();

  if (!isHydrated) {
    return (
      <div className="p-4 md:p-8">
        <div className="mb-6 md:mb-8">
          <h1 className="text-2xl md:text-3xl font-bold text-light-text dark:text-white">Podcast Library</h1>
        </div>
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 text-light-primary dark:text-sky-500 animate-spin" />
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8 animate-fadeIn">
      {/* Header */}
      <div className="mb-6 md:mb-8">
        <h1 className="text-2xl md:text-3xl font-bold text-light-text dark:text-white">Podcast Library</h1>
        <p className="text-gray-500 dark:text-zinc-400 mt-1">
          {podcasts.length} subscription{podcasts.length !== 1 ? "s" : ""}
        </p>
      </div>

      {/* Podcasts Grid */}
      {podcasts.length > 0 ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 md:gap-6">
          {podcasts.map((podcast, index) => (
            <div
              key={podcast.id}
              className="animate-fadeIn"
              style={{ animationDelay: `${index * 60}ms` }}
            >
              <PodcastCard podcast={podcast} newEpisodeCount={getNewEpisodeCount(podcast.id)} />
            </div>
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-20 text-center animate-fadeIn">
          <Library className="w-16 h-16 text-gray-300 dark:text-zinc-700 mb-4" />
          <h2 className="text-xl font-semibold text-gray-500 dark:text-zinc-400">
            No podcasts yet
          </h2>
          <p className="text-gray-400 dark:text-zinc-500 mt-2">
            Search and subscribe to podcasts to build your library
          </p>
        </div>
      )}
    </div>
  );
}
