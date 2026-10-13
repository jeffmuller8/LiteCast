"use client";

import { PodcastCard } from "@/components/podcast-card";
import { useSubscriptions } from "@/lib/subscription-context";
import { Library, Loader2 } from "lucide-react";

export default function LibraryPage() {
  const { podcasts, isHydrated } = useSubscriptions();

  if (!isHydrated) {
    return (
      <div className="p-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold">Podcast Library</h1>
        </div>
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 text-purple-500 animate-spin" />
        </div>
      </div>
    );
  }

  return (
    <div className="p-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold">Podcast Library</h1>
        <p className="text-zinc-400 mt-1">
          {podcasts.length} subscription{podcasts.length !== 1 ? "s" : ""}
        </p>
      </div>

      {/* Podcasts Grid */}
      {podcasts.length > 0 ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-6">
          {podcasts.map((podcast) => (
            <PodcastCard key={podcast.id} podcast={podcast} />
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <Library className="w-16 h-16 text-zinc-700 mb-4" />
          <h2 className="text-xl font-semibold text-zinc-400">
            No podcasts yet
          </h2>
          <p className="text-zinc-500 mt-2">
            Search and subscribe to podcasts to build your library
          </p>
        </div>
      )}
    </div>
  );
}
