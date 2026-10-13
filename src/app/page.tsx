"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { EpisodeItem } from "@/components/episode-item";
import { useSubscriptions } from "@/lib/subscription-context";
import { usePlayer } from "@/lib/player-context";
import { Search, Headphones, ListMusic, Play, GripVertical, X } from "lucide-react";
import { formatDuration } from "@/lib/mock-data";

type Tab = "new-releases" | "in-progress" | "queue";

export default function Home() {
  const [activeTab, setActiveTab] = useState<Tab>("new-releases");
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  const { podcasts, getNewReleases, getInProgressEpisodes } = useSubscriptions();
  const { queue, queueIndex, currentEpisode, play, reorderQueue, removeFromQueue } = usePlayer();

  const newReleases = getNewReleases();
  const inProgressEpisodes = getInProgressEpisodes();
  const hasPodcasts = podcasts.length > 0;
  const upcomingEpisodes = queue.slice(queueIndex + 1);

  const handleDragStart = (index: number) => {
    setDraggedIndex(index);
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (draggedIndex !== null && draggedIndex !== index) {
      setDragOverIndex(index);
    }
  };

  const handleDragLeave = () => {
    setDragOverIndex(null);
  };

  const handleDrop = (e: React.DragEvent, toIndex: number) => {
    e.preventDefault();
    if (draggedIndex !== null && draggedIndex !== toIndex) {
      reorderQueue(draggedIndex, toIndex);
    }
    setDraggedIndex(null);
    setDragOverIndex(null);
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
    setDragOverIndex(null);
  };

  return (
    <div className="p-8">
      {/* Episodes Tabs */}
      <section>
        {/* Tab Headers */}
        <div className="flex gap-1 mb-6 border-b border-zinc-800">
          <button
            onClick={() => setActiveTab("new-releases")}
            className={`px-4 py-3 text-sm font-medium transition-colors relative ${
              activeTab === "new-releases"
                ? "text-white"
                : "text-zinc-400 hover:text-zinc-200"
            }`}
          >
            New Releases
            {newReleases.length > 0 && (
              <span className="ml-2 px-2 py-0.5 text-xs rounded-full bg-purple-600 text-white">
                {newReleases.length}
              </span>
            )}
            {activeTab === "new-releases" && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-purple-500" />
            )}
          </button>
          <button
            onClick={() => setActiveTab("in-progress")}
            className={`px-4 py-3 text-sm font-medium transition-colors relative ${
              activeTab === "in-progress"
                ? "text-white"
                : "text-zinc-400 hover:text-zinc-200"
            }`}
          >
            In Progress
            {inProgressEpisodes.length > 0 && (
              <span className="ml-2 px-2 py-0.5 text-xs rounded-full bg-zinc-700 text-zinc-300">
                {inProgressEpisodes.length}
              </span>
            )}
            {activeTab === "in-progress" && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-purple-500" />
            )}
          </button>
          <button
            onClick={() => setActiveTab("queue")}
            className={`px-4 py-3 text-sm font-medium transition-colors relative ${
              activeTab === "queue"
                ? "text-white"
                : "text-zinc-400 hover:text-zinc-200"
            }`}
          >
            Queue ({queue.length})
            {activeTab === "queue" && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-purple-500" />
            )}
          </button>
        </div>

        {/* Tab Content */}
        {activeTab === "new-releases" && (
          <div className="space-y-3">
            {newReleases.length > 0 ? (
              newReleases.map((episode) => (
                <EpisodeItem
                  key={episode.id}
                  episode={episode}
                  showPodcastInfo
                />
              ))
            ) : hasPodcasts ? (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <Headphones className="w-12 h-12 text-zinc-700 mb-4" />
                <p className="text-zinc-400 font-medium">You&apos;re all caught up!</p>
                <p className="text-zinc-500 text-sm mt-1">No new episodes from your podcasts</p>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <Search className="w-12 h-12 text-zinc-700 mb-4" />
                <p className="text-zinc-400 font-medium">No podcasts yet</p>
                <p className="text-zinc-500 text-sm mt-1 mb-4">Subscribe to podcasts to see new episodes here</p>
                <Link
                  href="/search"
                  className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-500 transition-colors"
                >
                  Find Podcasts
                </Link>
              </div>
            )}
          </div>
        )}

        {activeTab === "in-progress" && (
          <div className="space-y-3">
            {inProgressEpisodes.length > 0 ? (
              inProgressEpisodes.map((episode) => (
                <EpisodeItem
                  key={episode.id}
                  episode={episode}
                  showPodcastInfo
                  progress={episode.progress}
                />
              ))
            ) : (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <Headphones className="w-12 h-12 text-zinc-700 mb-4" />
                <p className="text-zinc-400 font-medium">No episodes in progress</p>
                <p className="text-zinc-500 text-sm mt-1">Start listening to see your progress here</p>
              </div>
            )}
          </div>
        )}

        {activeTab === "queue" && (
          <div className="space-y-3">
            {/* Now Playing */}
            {currentEpisode && (
              <div className="mb-6">
                <h3 className="text-sm font-medium text-zinc-400 mb-3">Now Playing</h3>
                <div className="p-4 rounded-xl bg-purple-500/10 border border-purple-500/20">
                  <div className="flex items-center gap-4">
                    <Image
                      src={currentEpisode.podcastArtworkUrl}
                      alt={currentEpisode.title}
                      width={64}
                      height={64}
                      className="rounded-lg"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-purple-400 font-medium mb-1">
                        {currentEpisode.podcastTitle}
                      </p>
                      <p className="font-medium text-white truncate">
                        {currentEpisode.title}
                      </p>
                      <p className="text-sm text-zinc-400">
                        {formatDuration(currentEpisode.duration)}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Up Next - Draggable */}
            {upcomingEpisodes.length > 0 ? (
              <div>
                <h3 className="text-sm font-medium text-zinc-400 mb-3">
                  Up Next
                  <span className="text-zinc-600 ml-2 text-xs font-normal">
                    Drag to reorder
                  </span>
                </h3>
                <div className="space-y-2">
                  {upcomingEpisodes.map((episode, index) => (
                    <div
                      key={episode.id}
                      draggable
                      onDragStart={() => handleDragStart(index)}
                      onDragOver={(e) => handleDragOver(e, index)}
                      onDragLeave={handleDragLeave}
                      onDrop={(e) => handleDrop(e, index)}
                      onDragEnd={handleDragEnd}
                      className={`p-3 rounded-xl transition-all flex items-center gap-3 group cursor-grab active:cursor-grabbing ${
                        draggedIndex === index
                          ? "opacity-50 bg-zinc-800/60"
                          : dragOverIndex === index
                          ? "bg-purple-500/20 border-2 border-purple-500 border-dashed"
                          : "bg-zinc-800/30 hover:bg-zinc-800/60"
                      }`}
                    >
                      {/* Drag handle */}
                      <div className="text-zinc-600 hover:text-zinc-400 transition-colors">
                        <GripVertical className="w-5 h-5" />
                      </div>

                      <span className="text-lg font-medium text-zinc-500 w-6">
                        {index + 1}
                      </span>
                      <Image
                        src={episode.podcastArtworkUrl}
                        alt={episode.title}
                        width={48}
                        height={48}
                        className="rounded-lg"
                      />
                      <div className="flex-1 min-w-0 text-left">
                        <p className="text-xs text-zinc-500 mb-0.5">
                          {episode.podcastTitle}
                        </p>
                        <p className="font-medium text-zinc-200 truncate group-hover:text-white">
                          {episode.title}
                        </p>
                      </div>
                      <span className="text-sm text-zinc-500">
                        {formatDuration(episode.duration)}
                      </span>

                      {/* Play button */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          play(episode);
                        }}
                        className="p-2 text-zinc-500 hover:text-white transition-colors opacity-0 group-hover:opacity-100"
                      >
                        <Play className="w-5 h-5" />
                      </button>

                      {/* Remove button */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          removeFromQueue(index);
                        }}
                        className="p-2 text-zinc-500 hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100"
                      >
                        <X className="w-5 h-5" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            ) : !currentEpisode ? (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <ListMusic className="w-12 h-12 text-zinc-700 mb-4" />
                <p className="text-zinc-400 font-medium">Queue is empty</p>
                <p className="text-zinc-500 text-sm mt-1">
                  Use &quot;Play All&quot; on a podcast to add episodes to the queue
                </p>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <p className="text-zinc-500">No more episodes in queue</p>
              </div>
            )}
          </div>
        )}
      </section>
    </div>
  );
}
