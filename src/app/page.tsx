"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { EpisodeItem } from "@/components/episode-item";
import { useSubscriptions } from "@/lib/subscription-context";
import { usePlayer } from "@/lib/player-context";
import { Search, Headphones, ListMusic, Play, GripVertical, X } from "lucide-react";
import { formatDuration } from "@/lib/mock-data";

type Tab = "new-releases" | "in-progress" | "queue";

const tabOrder: Tab[] = ["new-releases", "in-progress", "queue"];

export default function Home() {
  const [activeTab, setActiveTab] = useState<Tab>("new-releases");
  const [animationKey, setAnimationKey] = useState(0);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const [indicatorStyle, setIndicatorStyle] = useState({ left: 0, width: 0, opacity: 0 });
  const tabsRef = useRef<HTMLDivElement>(null);
  const buttonRefs = useRef<(HTMLButtonElement | null)[]>([]);

  const { podcasts, getNewReleases, getInProgressEpisodes } = useSubscriptions();
  const { queue, queueIndex, currentEpisode, play, reorderQueue, removeFromQueue } = usePlayer();

  const newReleases = getNewReleases();
  const inProgressEpisodes = getInProgressEpisodes();
  const hasPodcasts = podcasts.length > 0;
  const upcomingEpisodes = queue.slice(queueIndex + 1);

  const activeIndex = tabOrder.indexOf(activeTab);

  // Update indicator position when active tab changes
  useEffect(() => {
    if (activeIndex >= 0 && buttonRefs.current[activeIndex] && tabsRef.current) {
      const button = buttonRefs.current[activeIndex];
      const container = tabsRef.current;
      if (button) {
        const buttonRect = button.getBoundingClientRect();
        const containerRect = container.getBoundingClientRect();
        setIndicatorStyle({
          left: buttonRect.left - containerRect.left,
          width: buttonRect.width,
          opacity: 1,
        });
      }
    }
  }, [activeIndex]);

  // Trigger animation when tab changes
  const handleTabChange = (tab: Tab) => {
    setActiveTab(tab);
    setAnimationKey(prev => prev + 1);
  };

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
    <div className="animate-fadeIn">
      {/* Episodes Tabs */}
      <section>
        {/* Tab Headers - Sticky */}
        <div className="sticky top-0 z-20 bg-light-bg dark:bg-zinc-950 p-4 md:px-8 md:pt-3 pb-0 flex justify-center md:block">
          <div
            ref={tabsRef}
            className="relative inline-flex gap-1 p-1 rounded-xl bg-gray-100 dark:bg-zinc-800/50 border border-gray-200 dark:border-zinc-700"
          >
          {/* Sliding indicator */}
          <div
            className="absolute top-1 bottom-1 rounded-lg bg-white dark:bg-zinc-700 border border-gray-200 dark:border-zinc-600 shadow-sm transition-all duration-300 ease-out pointer-events-none"
            style={{
              left: indicatorStyle.left,
              width: indicatorStyle.width,
              opacity: indicatorStyle.opacity,
            }}
          />

          <button
            ref={(el) => { buttonRefs.current[0] = el; }}
            onClick={() => handleTabChange("new-releases")}
            className={`px-4 py-2 text-sm font-medium transition-colors relative rounded-lg ${
              activeTab === "new-releases"
                ? "text-light-text dark:text-white"
                : "text-gray-500 dark:text-zinc-400 hover:text-gray-700 dark:hover:text-zinc-200"
            }`}
          >
            <span className="relative z-10">New Releases</span>
            {newReleases.length > 0 && (
              <span className="relative z-10 ml-2 px-2 py-0.5 text-xs rounded-full bg-light-primary dark:bg-sky-600 text-white">
                {newReleases.length}
              </span>
            )}
          </button>
          <button
            ref={(el) => { buttonRefs.current[1] = el; }}
            onClick={() => handleTabChange("in-progress")}
            className={`px-4 py-2 text-sm font-medium transition-colors relative rounded-lg ${
              activeTab === "in-progress"
                ? "text-light-text dark:text-white"
                : "text-gray-500 dark:text-zinc-400 hover:text-gray-700 dark:hover:text-zinc-200"
            }`}
          >
            <span className="relative z-10">In Progress</span>
            {inProgressEpisodes.length > 0 && (
              <span className="relative z-10 ml-2 px-2 py-0.5 text-xs rounded-full bg-gray-300 dark:bg-zinc-700 text-gray-600 dark:text-zinc-300">
                {inProgressEpisodes.length}
              </span>
            )}
          </button>
          <button
            ref={(el) => { buttonRefs.current[2] = el; }}
            onClick={() => handleTabChange("queue")}
            className={`px-4 py-2 text-sm font-medium transition-colors relative rounded-lg ${
              activeTab === "queue"
                ? "text-light-text dark:text-white"
                : "text-gray-500 dark:text-zinc-400 hover:text-gray-700 dark:hover:text-zinc-200"
            }`}
          >
            <span className="relative z-10">Queue ({queue.length})</span>
          </button>
        </div>
        </div>

        {/* Tab Content */}
        <div className="px-4 md:px-8 pt-[5px] md:pt-2.5 pb-4 md:pb-8">
        {activeTab === "new-releases" && (
          <div key={`new-releases-${animationKey}`} className="space-y-3">
            {newReleases.length > 0 ? (
              newReleases.map((episode, index) => (
                <div
                  key={episode.id}
                  className="animate-slideDown"
                  style={{ animationDelay: `${index * 50}ms` }}
                >
                  <EpisodeItem
                    episode={episode}
                    showPodcastInfo
                  />
                </div>
              ))
            ) : hasPodcasts ? (
              <div className="flex flex-col items-center justify-center py-16 text-center animate-fadeIn">
                <Headphones className="w-12 h-12 text-gray-300 dark:text-zinc-700 mb-4" />
                <p className="text-gray-500 dark:text-zinc-400 font-medium">You&apos;re all caught up!</p>
                <p className="text-gray-400 dark:text-zinc-500 text-sm mt-1">No new episodes from your podcasts</p>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-16 text-center animate-fadeIn">
                <Search className="w-12 h-12 text-gray-300 dark:text-zinc-700 mb-4" />
                <p className="text-gray-500 dark:text-zinc-400 font-medium">No podcasts yet</p>
                <p className="text-gray-400 dark:text-zinc-500 text-sm mt-1 mb-4">Subscribe to podcasts to see new episodes here</p>
                <Link
                  href="/search"
                  className="px-4 py-2 bg-light-primary dark:bg-sky-600 text-white rounded-lg hover:bg-light-primary/90 dark:hover:bg-sky-500 transition-colors"
                >
                  Find Podcasts
                </Link>
              </div>
            )}
          </div>
        )}

        {activeTab === "in-progress" && (
          <div key={`in-progress-${animationKey}`} className="space-y-3">
            {inProgressEpisodes.length > 0 ? (
              inProgressEpisodes.map((episode, index) => (
                <div
                  key={episode.id}
                  className="animate-slideDown"
                  style={{ animationDelay: `${index * 50}ms` }}
                >
                  <EpisodeItem
                    episode={episode}
                    showPodcastInfo
                    progress={episode.progress}
                  />
                </div>
              ))
            ) : (
              <div className="flex flex-col items-center justify-center py-16 text-center animate-fadeIn">
                <Headphones className="w-12 h-12 text-gray-300 dark:text-zinc-700 mb-4" />
                <p className="text-gray-500 dark:text-zinc-400 font-medium">No episodes in progress</p>
                <p className="text-gray-400 dark:text-zinc-500 text-sm mt-1">Start listening to see your progress here</p>
              </div>
            )}
          </div>
        )}

        {activeTab === "queue" && (
          <div key={`queue-${animationKey}`} className="space-y-3">
            {/* Now Playing */}
            {currentEpisode && (
              <div className="mb-6 animate-slideDown">
                <h3 className="text-sm font-medium text-gray-500 dark:text-zinc-400 mb-3">Now Playing</h3>
                <div className="p-4 rounded-xl bg-light-primary/10 dark:bg-sky-500/10 border border-light-primary/20 dark:border-sky-500/20">
                  <div className="flex items-center gap-4">
                    <Image
                      src={currentEpisode.podcastArtworkUrl}
                      alt={currentEpisode.title}
                      width={64}
                      height={64}
                      className="rounded-lg"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-light-primary dark:text-sky-400 font-medium mb-1">
                        {currentEpisode.podcastTitle}
                      </p>
                      <p className="font-medium text-light-text dark:text-white truncate">
                        {currentEpisode.title}
                      </p>
                      <p className="text-sm text-gray-500 dark:text-zinc-400">
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
                <h3 className="text-sm font-medium text-gray-500 dark:text-zinc-400 mb-3">
                  Up Next
                  <span className="text-gray-400 dark:text-zinc-600 ml-2 text-xs font-normal">
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
                      className={`p-3 rounded-xl transition-all flex items-center gap-3 group cursor-grab active:cursor-grabbing animate-slideDown ${
                        draggedIndex === index
                          ? "opacity-50 bg-gray-200 dark:bg-zinc-800/60"
                          : dragOverIndex === index
                          ? "bg-light-primary/20 dark:bg-sky-500/20 border-2 border-light-primary dark:border-sky-500 border-dashed"
                          : "bg-light-surface/50 dark:bg-zinc-800/30 hover:bg-light-surface dark:hover:bg-zinc-800/60"
                      }`}
                      style={{ animationDelay: `${(index + 1) * 50}ms` }}
                    >
                      {/* Drag handle */}
                      <div className="text-gray-400 dark:text-zinc-600 hover:text-gray-600 dark:hover:text-zinc-400 transition-colors">
                        <GripVertical className="w-5 h-5" />
                      </div>

                      <span className="text-lg font-medium text-gray-400 dark:text-zinc-500 w-6">
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
                        <p className="text-xs text-gray-400 dark:text-zinc-500 mb-0.5">
                          {episode.podcastTitle}
                        </p>
                        <p className="font-medium text-gray-700 dark:text-zinc-200 truncate group-hover:text-light-text dark:group-hover:text-white">
                          {episode.title}
                        </p>
                      </div>
                      <span className="text-sm text-gray-400 dark:text-zinc-500">
                        {formatDuration(episode.duration)}
                      </span>

                      {/* Play button */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          play(episode);
                        }}
                        className="p-2 text-gray-400 dark:text-zinc-500 hover:text-light-text dark:hover:text-white transition-colors opacity-0 group-hover:opacity-100"
                      >
                        <Play className="w-5 h-5" />
                      </button>

                      {/* Remove button */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          removeFromQueue(index);
                        }}
                        className="p-2 text-gray-400 dark:text-zinc-500 hover:text-red-500 dark:hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100"
                      >
                        <X className="w-5 h-5" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            ) : !currentEpisode ? (
              <div className="flex flex-col items-center justify-center py-16 text-center animate-fadeIn">
                <ListMusic className="w-12 h-12 text-gray-300 dark:text-zinc-700 mb-4" />
                <p className="text-gray-500 dark:text-zinc-400 font-medium">Queue is empty</p>
                <p className="text-gray-400 dark:text-zinc-500 text-sm mt-1">
                  Use &quot;Play All&quot; on a podcast to add episodes to the queue
                </p>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-8 text-center animate-fadeIn">
                <p className="text-gray-400 dark:text-zinc-500">No more episodes in queue</p>
              </div>
            )}
          </div>
        )}
        </div>
      </section>
    </div>
  );
}
