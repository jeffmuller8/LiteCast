"use client";

import { use, useState, useMemo } from "react";
import Image from "next/image";
import Link from "next/link";
import { ArrowLeft, Play, ListMusic, Share2, ArrowUp, ArrowDown, RefreshCw, Pin } from "lucide-react";
import { EpisodeItem } from "@/components/episode-item";
import { useSubscriptions } from "@/lib/subscription-context";
import { usePlayer } from "@/lib/player-context";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/toast";
import { Tooltip } from "@/components/tooltip";

type SortOrder = "newest" | "oldest";

export default function PodcastPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { podcasts, episodes: allEpisodes, unsubscribe, isHydrated, fetchAllEpisodes, isPinned, togglePin } = useSubscriptions();
  const { play, playAll } = usePlayer();
  const router = useRouter();
  const { showToast } = useToast();
  const [sortOrder, setSortOrder] = useState<SortOrder>("newest");
  const [isFetching, setIsFetching] = useState(false);

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
          className="inline-flex items-center gap-2 text-gray-500 dark:text-zinc-400 hover:text-light-primary dark:hover:text-sky-400 transition-colors mb-6"
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

  const handleFetchAllEpisodes = async () => {
    setIsFetching(true);
    try {
      const result = await fetchAllEpisodes(decodedId);
      if (result.added > 0) {
        showToast(`Added ${result.added} new episodes (${result.total} total)`);
      } else {
        showToast(`All ${result.total} episodes already fetched`);
      }
    } catch (error) {
      showToast("Failed to fetch episodes");
    } finally {
      setIsFetching(false);
    }
  };

  return (
    <div className="p-4 md:p-8 animate-fadeIn">
      {/* Back button */}
      <Link
        href="/library"
        className="inline-flex items-center gap-2 text-gray-500 dark:text-zinc-400 hover:text-light-primary dark:hover:text-sky-400 transition-colors mb-4 md:mb-6"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to Library
      </Link>

      {/* Podcast header */}
      <div className="flex flex-col md:flex-row gap-4 md:gap-8 mb-6 md:mb-8">
        <Image
          src={podcast.artworkUrl}
          alt={podcast.title}
          width={200}
          height={200}
          className="rounded-2xl shadow-2xl w-32 h-32 md:w-[200px] md:h-[200px] mx-auto md:mx-0"
          unoptimized
        />
        <div className="flex-1 text-center md:text-left">
          <h1 className="text-2xl md:text-4xl font-bold mb-2">{podcast.title}</h1>
          <p className="text-lg md:text-xl text-zinc-400 mb-2 md:mb-4">{podcast.author}</p>
          <p className="text-zinc-400 mb-4 md:mb-6 max-w-2xl line-clamp-3 text-sm md:text-base">
            {podcast.description}
          </p>

          {/* Actions */}
          <div className="flex items-center justify-center md:justify-start gap-2 md:gap-3 flex-wrap">
            <button
              onClick={handlePlayLatest}
              disabled={episodes.length === 0}
              className="flex items-center gap-2 px-4 md:px-6 py-2 md:py-3 bg-light-primary dark:bg-sky-600 text-white rounded-full font-medium hover:bg-light-primary/90 dark:hover:bg-sky-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm md:text-base"
            >
              <Play className="w-4 h-4 md:w-5 md:h-5" />
              Play Latest
            </button>
            <button
              onClick={handlePlayAll}
              disabled={episodes.length === 0}
              className="flex items-center gap-2 px-3 md:px-5 py-2 md:py-2.5 border border-gray-300 dark:border-zinc-600 text-gray-600 dark:text-zinc-300 rounded-full font-medium hover:border-light-primary dark:hover:border-sky-500 hover:text-light-primary dark:hover:text-sky-400 hover:bg-light-primary/10 dark:hover:bg-sky-500/10 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm md:text-base"
            >
              <ListMusic className="w-4 h-4 md:w-5 md:h-5" />
              Play All
            </button>
            <Tooltip content={isPinned(decodedId) ? "Unpin from top of New Releases" : "Pin to top of New Releases"}>
              <button
                onClick={() => {
                  togglePin(decodedId);
                  showToast(isPinned(decodedId) ? `Unpinned ${podcast.title}` : `Pinned ${podcast.title} to New Releases`);
                }}
                className={`p-3 rounded-full transition-colors ${
                  isPinned(decodedId)
                    ? "text-light-primary dark:text-sky-400 bg-light-primary/10 dark:bg-sky-500/10"
                    : "text-gray-500 dark:text-zinc-400 hover:text-light-text dark:hover:text-white hover:bg-gray-200 dark:hover:bg-zinc-800"
                }`}
              >
                <Pin className={`w-5 h-5 ${isPinned(decodedId) ? "fill-current" : ""}`} />
              </button>
            </Tooltip>
            <Tooltip content="Copy RSS feed link">
              <button
                onClick={() => {
                  if (podcast.feedUrl) {
                    navigator.clipboard.writeText(podcast.feedUrl);
                    showToast(`${podcast.title} RSS feed link copied to clipboard`);
                  }
                }}
                className="p-3 text-gray-500 dark:text-zinc-400 hover:text-light-text dark:hover:text-white hover:bg-gray-200 dark:hover:bg-zinc-800 rounded-full transition-colors"
              >
                <Share2 className="w-5 h-5" />
              </button>
            </Tooltip>
            <button
              onClick={handleUnsubscribe}
              className="flex items-center gap-2 px-5 py-2.5 border border-gray-300 dark:border-zinc-600 text-gray-600 dark:text-zinc-300 rounded-full font-medium hover:border-red-500 dark:hover:border-red-500 hover:text-red-500 dark:hover:text-red-400 hover:bg-red-500/10 dark:hover:bg-red-500/10 transition-colors"
            >
              Unsubscribe
            </button>
          </div>
        </div>
      </div>

      {/* Episodes */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-xl font-semibold">
              Episodes ({episodes.length})
            </h2>
            <button
              onClick={handleFetchAllEpisodes}
              disabled={isFetching}
              className="flex items-center gap-1.5 text-sm text-light-primary dark:text-sky-400 hover:text-light-primary/80 dark:hover:text-sky-300 transition-colors mt-1 disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isFetching ? "animate-spin" : ""}`} />
              {isFetching ? "Fetching..." : "Fetch All Episodes"}
            </button>
          </div>
          <button
            onClick={toggleSortOrder}
            className="flex items-center gap-2 px-3 py-1.5 text-sm text-gray-500 dark:text-zinc-400 hover:text-light-text dark:hover:text-white hover:bg-gray-200 dark:hover:bg-zinc-800 rounded-lg transition-colors"
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
