"use client";

import { useState, useRef, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Play, Pause, Download, MoreHorizontal, Bookmark, BookmarkCheck, ListPlus, UserMinus } from "lucide-react";
import { usePlayer } from "@/lib/player-context";
import { useSubscriptions } from "@/lib/subscription-context";
import { useToast } from "@/components/toast";
import { sanitizeShowNotes } from "@/lib/sanitize-html";

interface Episode {
  id: string;
  podcastId?: string;
  title: string;
  description: string;
  audioUrl: string;
  duration: number;
  publishedAt: string;
  artworkUrl?: string;
  podcastTitle?: string;
  podcastArtworkUrl?: string;
}

interface EpisodeItemProps {
  episode: Episode;
  podcastTitle?: string;
  podcastArtworkUrl?: string;
  showPodcastInfo?: boolean;
  progress?: number; // 0-100 percentage
}

function formatDuration(seconds: number): string {
  if (!seconds || seconds <= 0) return "0:00";
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  }
  return `${minutes}:${secs.toString().padStart(2, "0")}`;
}

function getDurationParts(seconds: number): { hours: number; minutes: number } {
  if (!seconds || seconds <= 0) return { hours: 0, minutes: 0 };
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  return { hours, minutes };
}

function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

// Strip HTML tags from description (for preview)
function stripHtml(html: string): string {
  return html
    .replace(/<[^>]*>/g, "") // Remove HTML tags
    .replace(/&nbsp;/g, " ") // Replace &nbsp; with space
    .replace(/&amp;/g, "&") // Replace &amp; with &
    .replace(/&lt;/g, "<") // Replace &lt; with <
    .replace(/&gt;/g, ">") // Replace &gt; with >
    .replace(/&quot;/g, '"') // Replace &quot; with "
    .replace(/&#39;/g, "'") // Replace &#39; with '
    .replace(/\s+/g, " ") // Collapse multiple spaces
    .trim();
}

export function EpisodeItem({
  episode,
  podcastTitle,
  podcastArtworkUrl,
  showPodcastInfo = false,
  progress,
}: EpisodeItemProps) {
  const router = useRouter();
  const { play, currentEpisode, isPlaying, togglePlayPause, addToQueue } = usePlayer();
  const { unsubscribe, toggleBookmark, isBookmarked } = useSubscriptions();
  const { showToast } = useToast();
  const episodeIsBookmarked = isBookmarked(episode.id);
  const [showMenu, setShowMenu] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [showUnsubscribeModal, setShowUnsubscribeModal] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const isCurrentEpisode = currentEpisode?.id === episode.id;

  // Check if mobile (under md breakpoint)
  const isMobile = typeof window !== "undefined" && window.innerWidth < 768;

  const artworkUrl = episode.podcastArtworkUrl || podcastArtworkUrl || "https://picsum.photos/seed/default/400/400";
  const title = episode.podcastTitle || podcastTitle || "";
  const cleanDescription = stripHtml(episode.description);

  // Close menu when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setShowMenu(false);
      }
    }

    if (showMenu) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [showMenu]);

  const handlePlay = () => {
    if (isCurrentEpisode) {
      togglePlayPause();
    } else {
      play({
        ...episode,
        podcastTitle: title,
        podcastArtworkUrl: artworkUrl,
      });
      // Navigate to full-screen player on mobile
      if (isMobile) {
        router.push("/player");
      }
    }
  };

  const handleAddToQueue = () => {
    const episodeWithInfo = {
      ...episode,
      podcastTitle: title,
      podcastArtworkUrl: artworkUrl,
    };

    addToQueue(episodeWithInfo);
    showToast(`Added "${episode.title}" to queue`);
    setShowMenu(false);
  };

  const handleUnsubscribeClick = () => {
    setShowMenu(false);
    setShowUnsubscribeModal(true);
  };

  const handleConfirmUnsubscribe = () => {
    if (episode.podcastId) {
      unsubscribe(episode.podcastId);
      showToast(`Unsubscribed from "${title}"`);
    }
    setShowUnsubscribeModal(false);
  };

  return (
    <div className="group p-3 md:p-4 rounded-xl bg-light-surface/50 dark:bg-zinc-800/30 hover:bg-light-surface dark:hover:bg-zinc-800/60 transition-all border border-gray-300 dark:border-zinc-700 shadow-sm hover:shadow-md dark:shadow-black/10 dark:hover:shadow-black/20">
      <div className="flex gap-3 md:gap-4">
        {/* Artwork */}
        <div className="relative w-12 h-12 md:w-16 md:h-16 flex-shrink-0">
          <Image
            src={episode.artworkUrl || artworkUrl}
            alt={episode.title}
            fill
            className="rounded-lg object-cover"
          />
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          {showPodcastInfo && episode.podcastId && (
            <Link
              href={`/podcast/${encodeURIComponent(episode.podcastId)}`}
              className="text-xs text-light-primary dark:text-sky-400 font-medium mb-1 hover:text-light-primary/80 dark:hover:text-sky-300 hover:underline transition-colors inline-block"
              onClick={(e) => e.stopPropagation()}
            >
              {title}
            </Link>
          )}
          {showPodcastInfo && !episode.podcastId && (
            <p className="text-xs text-light-primary dark:text-sky-400 font-medium mb-1">{title}</p>
          )}
          <h3 className="font-medium text-light-text dark:text-white line-clamp-2 group-hover:text-light-primary dark:group-hover:text-sky-300 transition-colors">
            {episode.title}
          </h3>
          <div className="flex items-center gap-2 mt-1 text-sm text-gray-500 dark:text-zinc-400">
            <span>{formatDate(episode.publishedAt)}</span>
            {progress !== undefined && (
              <>
                <span>•</span>
                <span className="text-light-primary dark:text-sky-400">{progress}% complete</span>
              </>
            )}
          </div>
          {progress !== undefined && (
            <div className="mt-2 h-1 bg-gray-300 dark:bg-zinc-700 rounded-full overflow-hidden">
              <div
                className="h-full bg-light-primary dark:bg-sky-500 rounded-full"
                style={{ width: `${progress}%` }}
              />
            </div>
          )}
        </div>

        {/* Actions - hidden on mobile */}
        <div className="hidden md:flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={() => {
              toggleBookmark(episode.id);
              showToast(episodeIsBookmarked ? "Removed from Bookmarks" : "Added to Bookmarks");
            }}
            className={`p-2 transition-colors ${
              episodeIsBookmarked
                ? "text-light-gold dark:text-yellow-500 hover:text-light-gold/80 dark:hover:text-yellow-400"
                : "text-gray-500 dark:text-zinc-400 hover:text-light-text dark:hover:text-white"
            }`}
            title={episodeIsBookmarked ? "Remove bookmark" : "Add bookmark"}
          >
            {episodeIsBookmarked ? (
              <BookmarkCheck className="w-5 h-5" />
            ) : (
              <Bookmark className="w-5 h-5" />
            )}
          </button>
          <button
            className="p-2 text-gray-500 dark:text-zinc-400 hover:text-light-text dark:hover:text-white transition-colors"
            title="Download episode"
          >
            <Download className="w-5 h-5" />
          </button>

          {/* More menu */}
          <div className="relative" ref={menuRef}>
            <button
              onClick={() => setShowMenu(!showMenu)}
              className="p-2 text-gray-500 dark:text-zinc-400 hover:text-light-text dark:hover:text-white transition-colors"
              title="More options"
            >
              <MoreHorizontal className="w-5 h-5" />
            </button>

            {showMenu && (
              <div className="absolute right-0 top-full mt-1 w-48 bg-white dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded-lg shadow-xl z-50 overflow-hidden">
                <button
                  onClick={handleAddToQueue}
                  className="w-full px-4 py-2.5 text-left text-sm text-light-text dark:text-zinc-200 hover:bg-gray-100 dark:hover:bg-zinc-700 flex items-center gap-3 transition-colors"
                >
                  <ListPlus className="w-4 h-4" />
                  Add to Queue
                </button>
                {episode.podcastId && (
                  <button
                    onClick={handleUnsubscribeClick}
                    className="w-full px-4 py-2.5 text-left text-sm text-red-500 dark:text-red-400 hover:bg-gray-100 dark:hover:bg-zinc-700 flex items-center gap-3 transition-colors"
                  >
                    <UserMinus className="w-4 h-4" />
                    Unsubscribe
                  </button>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Duration and Play/Pause button */}
        <div className="flex items-center gap-2 md:gap-3 flex-shrink-0">
          <div className="hidden md:block w-24 text-gray-500 dark:text-zinc-400 text-right whitespace-nowrap">
            {(() => {
              const { hours, minutes } = getDurationParts(episode.duration);
              if (hours > 0) {
                return (
                  <span>
                    <span className="text-base font-semibold text-gray-700 dark:text-zinc-200">{hours}</span>
                    <span className="text-xs ml-0.5">hr</span>
                    <span className="text-base font-semibold text-gray-700 dark:text-zinc-200 ml-1">{minutes}</span>
                    <span className="text-xs ml-0.5">min</span>
                  </span>
                );
              }
              return (
                <span>
                  <span className="text-base font-semibold text-gray-700 dark:text-zinc-200">{minutes}</span>
                  <span className="text-xs ml-0.5">min</span>
                </span>
              );
            })()}
          </div>
          <button
            onClick={handlePlay}
            className={`w-10 h-10 md:w-12 md:h-12 rounded-full flex items-center justify-center transition-all ${
              isCurrentEpisode && isPlaying
                ? "bg-light-primary dark:bg-sky-600 text-white"
                : "bg-light-primary dark:bg-sky-600 text-white hover:scale-105"
            }`}
          >
            {isCurrentEpisode && isPlaying ? (
              <Pause className="w-4 h-4 md:w-5 md:h-5" />
            ) : (
              <Play className="w-4 h-4 md:w-5 md:h-5 ml-0.5" />
            )}
          </button>
        </div>
      </div>

      {/* Description - clickable to expand */}
      {!isExpanded ? (
        <>
          <p
            onClick={() => setIsExpanded(true)}
            className="mt-3 text-sm text-gray-500 dark:text-zinc-400 cursor-pointer hover:text-gray-600 dark:hover:text-zinc-300 transition-colors line-clamp-2"
          >
            {cleanDescription}
          </p>
          {cleanDescription.length > 150 && (
            <button
              onClick={() => setIsExpanded(true)}
              className="text-xs text-light-primary dark:text-sky-400 hover:text-light-primary/80 dark:hover:text-sky-300 mt-1"
            >
              Show more
            </button>
          )}
        </>
      ) : (
        <>
          <div
            onClick={(e) => {
              // Don't collapse if clicking a link
              if ((e.target as HTMLElement).tagName !== 'A') {
                setIsExpanded(false);
              }
            }}
            className="mt-3 text-sm text-gray-500 dark:text-zinc-400 cursor-pointer hover:text-gray-600 dark:hover:text-zinc-300 transition-colors [&_p]:my-2 [&_ul]:my-2 [&_ul]:list-disc [&_ul]:ml-4 [&_ol]:my-2 [&_ol]:list-decimal [&_ol]:ml-4 [&_li]:my-1 [&_br]:my-1 [&_strong]:font-semibold [&_em]:italic"
            dangerouslySetInnerHTML={{ __html: sanitizeShowNotes(episode.description) }}
          />
          <button
            onClick={() => setIsExpanded(false)}
            className="text-xs text-light-primary dark:text-sky-400 hover:text-light-primary/80 dark:hover:text-sky-300 mt-1"
          >
            Show less
          </button>
        </>
      )}

      {/* Unsubscribe Confirmation Modal */}
      {showUnsubscribeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setShowUnsubscribeModal(false)}
          />

          {/* Modal */}
          <div className="relative bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-700 rounded-xl p-6 max-w-md w-full mx-4 shadow-2xl">
            <h3 className="text-lg font-semibold text-light-text dark:text-white mb-2">
              Unsubscribe from podcast?
            </h3>
            <p className="text-gray-500 dark:text-zinc-400 text-sm mb-6">
              Are you sure you want to unsubscribe from <span className="text-light-text dark:text-white font-medium">{title}</span>?
              This will remove all episodes from your library.
            </p>

            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setShowUnsubscribeModal(false)}
                className="px-4 py-2 text-sm font-medium text-gray-600 dark:text-zinc-300 hover:text-light-text dark:hover:text-white hover:bg-gray-100 dark:hover:bg-zinc-800 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmUnsubscribe}
                className="px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-500 rounded-lg transition-colors"
              >
                Unsubscribe
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
