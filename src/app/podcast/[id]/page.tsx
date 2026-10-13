"use client";

import { use, useState, useMemo } from "react";
import Image from "next/image";
import Link from "next/link";
import { ArrowLeft, Play, ListMusic, Share2, ArrowUp, ArrowDown } from "lucide-react";
import { EpisodeItem } from "@/components/episode-item";
import { useSubscriptions } from "@/lib/subscription-context";
import { usePlayer } from "@/lib/player-context";
import { useRouter } from "next/navigation";

type SortOrder = "newest" | "oldest";

export default function PodcastPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { podcasts, episodes: allEpisodes, unsubscribe, isHydrated } = useSubscriptions();
  const { play, playAll } = usePlayer();
  const router = useRouter();
  const [sortOrder, setSortOrder] = useState<SortOrder>("newest");

  // Decode the ID in case it was URL encoded
  const decodedId = decodeURIComponent(id);
  const podcast = podcasts.find((p) => p.id === decodedId);
  const podcastEpisodes = allEpisodes.filter((e) => e.podcastId === decodedId);

  // Sort episodes based on selected order
  const episodes = useMemo(() => {
    return [...podcastEpisodes].sort((a, b) => {
      const dateA = new Date(a.publishedAt).getTime();
      const dateB = new Date(b.publishedAt).getTime();
      return sortOrder === "newest" ? dateB - dateA : dateA - dateB;
    });
  }, [podcastEpisodes, sortOrder]);

  const toggleSortOrder = () => {
    setSortOrder((prev) => (prev === "newest" ? "oldest" : "newest"));
  };

  // Show loading while hydrating from localStorage
  if (!isHydrated) {
    return (
      <div className="p-8">
        <div className="animate-pulse">
          <div className="h-6 w-32 bg-zinc-800 rounded mb-6"></div>
          <div className="flex gap-8">
            <div className="w-[200px] h-[200px] bg-zinc-800 rounded-2xl"></div>
            <div className="flex-1">
              <div className="h-10 w-64 bg-zinc-800 rounded mb-4"></div>
              <div className="h-6 w-48 bg-zinc-800 rounded mb-4"></div>
              <div className="h-20 w-full bg-zinc-800 rounded"></div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!podcast) {
    return (
      <div className="p-8">
        <Link
          href="/library"
          className="inline-flex items-center gap-2 text-zinc-400 hover:text-white transition-colors mb-6"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Library
        </Link>
        <p className="text-zinc-400">Podcast not found</p>
      </div>
    );
  }

  const handlePlayLatest = () => {
    if (episodes.length > 0) {
      play(episodes[0]);
    }
  };

  const handlePlayAll = () => {
    if (episodes.length > 0) {
      playAll(episodes);
    }
  };

  const handleUnsubscribe = () => {
    unsubscribe(decodedId);
    router.push("/library");
  };

  return (
    <div className="p-8">
      {/* Back button */}
      <Link
        href="/library"
        className="inline-flex items-center gap-2 text-zinc-400 hover:text-white transition-colors mb-6"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to Library
      </Link>

      {/* Podcast header */}
      <div className="flex gap-8 mb-8">
        <Image
          src={podcast.artworkUrl}
          alt={podcast.title}
          width={200}
          height={200}
          className="rounded-2xl shadow-2xl"
          unoptimized
        />
        <div className="flex-1">
          <h1 className="text-4xl font-bold mb-2">{podcast.title}</h1>
          <p className="text-xl text-zinc-400 mb-4">{podcast.author}</p>
          <p className="text-zinc-400 mb-6 max-w-2xl line-clamp-3">
            {podcast.description}
          </p>

          {/* Actions */}
          <div className="flex items-center gap-3">
            <button
              onClick={handlePlayLatest}
              disabled={episodes.length === 0}
              className="flex items-center gap-2 px-6 py-3 bg-purple-600 text-white rounded-full font-medium hover:bg-purple-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Play className="w-5 h-5" />
              Play Latest
            </button>
            <button
              onClick={handlePlayAll}
              disabled={episodes.length === 0}
              className="flex items-center gap-2 px-5 py-2.5 border border-zinc-600 text-zinc-300 rounded-full font-medium hover:border-purple-500 hover:text-purple-400 hover:bg-purple-500/10 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <ListMusic className="w-5 h-5" />
              Play All
            </button>
            <button className="p-3 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-full transition-colors">
              <Share2 className="w-5 h-5" />
            </button>
            <button
              onClick={handleUnsubscribe}
              className="px-5 py-2.5 border border-zinc-600 text-zinc-300 rounded-full font-medium hover:border-red-500 hover:text-red-400 hover:bg-red-500/10 transition-colors"
            >
              Unsubscribe
            </button>
          </div>
        </div>
      </div>

      {/* Episodes */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold">
            Episodes ({episodes.length})
          </h2>
          <button
            onClick={toggleSortOrder}
            className="flex items-center gap-2 px-3 py-1.5 text-sm text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-lg transition-colors"
          >
            {sortOrder === "newest" ? (
              <>
                <ArrowDown className="w-4 h-4" />
                Newest first
              </>
            ) : (
              <>
                <ArrowUp className="w-4 h-4" />
                Oldest first
              </>
            )}
          </button>
        </div>
        {episodes.length > 0 ? (
          <div className="space-y-3">
            {episodes.map((episode) => (
              <EpisodeItem
                key={episode.id}
                episode={episode}
              />
            ))}
          </div>
        ) : (
          <p className="text-zinc-500 py-8 text-center">No episodes available</p>
        )}
      </section>
    </div>
  );
}
