"use client";

import Image from "next/image";
import { Download, Play, Trash2 } from "lucide-react";
import { usePlayer } from "@/lib/player-context";
import { mockPodcasts, mockEpisodes } from "@/lib/mock-data";

// Simulate some downloaded episodes
const downloadedEpisodeIds = ["e1", "e3", "e5"];

function getDurationParts(seconds: number): { hours: number; minutes: number } {
  if (!seconds || seconds <= 0) return { hours: 0, minutes: 0 };
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  return { hours, minutes };
}

export default function DownloadsPage() {
  const { play } = usePlayer();

  const downloads = mockEpisodes
    .filter((ep) => downloadedEpisodeIds.includes(ep.id))
    .map((ep) => {
      const podcast = mockPodcasts.find((p) => p.id === ep.podcastId)!;
      // Deterministic file size based on duration (~1MB per minute of audio)
      const fileSize = Math.floor(ep.duration / 60);
      return {
        ...ep,
        podcastTitle: podcast.title,
        podcastArtworkUrl: podcast.artworkUrl,
        fileSize,
      };
    });

  const totalSize = downloads.reduce((acc, d) => acc + d.fileSize, 0);

  return (
    <div className="p-4 md:p-8 animate-fadeIn">
      {/* Header */}
      <div className="flex items-center justify-between mb-6 md:mb-8">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-light-text dark:text-white">Downloads</h1>
          <p className="text-gray-500 dark:text-zinc-400 mt-1">
            {downloads.length} episodes • {totalSize} MB
          </p>
        </div>
      </div>

      {downloads.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <Download className="w-16 h-16 text-gray-300 dark:text-zinc-700 mb-4" />
          <h2 className="text-xl font-semibold text-gray-500 dark:text-zinc-400">
            No downloads yet
          </h2>
          <p className="text-gray-400 dark:text-zinc-500 mt-2">
            Download episodes to listen offline
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {downloads.map((episode, index) => (
            <div
              key={episode.id}
              className="flex gap-3 md:gap-4 p-3 md:p-4 rounded-xl bg-light-surface/50 dark:bg-zinc-800/30 hover:bg-light-surface dark:hover:bg-zinc-800/60 transition-all group border border-gray-300 dark:border-zinc-700 shadow-sm hover:shadow-md dark:shadow-black/10 dark:hover:shadow-black/20 animate-slideDown"
              style={{ animationDelay: `${index * 50}ms` }}
            >
              {/* Artwork */}
              <div className="relative w-12 h-12 md:w-16 md:h-16 flex-shrink-0">
                <Image
                  src={episode.podcastArtworkUrl}
                  alt={episode.title}
                  fill
                  className="rounded-lg object-cover"
                />
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <p className="text-xs text-light-primary dark:text-sky-400 font-medium mb-1">
                  {episode.podcastTitle}
                </p>
                <h3 className="font-medium text-light-text dark:text-white line-clamp-1 group-hover:text-light-primary dark:group-hover:text-sky-300 transition-colors">
                  {episode.title}
                </h3>
                <div className="flex items-center gap-2 mt-1 text-sm text-gray-500 dark:text-zinc-400">
                  <span>{episode.fileSize} MB</span>
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-2">
                <button className="hidden md:block p-2 text-gray-400 dark:text-zinc-400 hover:text-red-500 dark:hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100">
                  <Trash2 className="w-5 h-5" />
                </button>

                {/* Duration and Play button */}
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
                    onClick={() =>
                      play({
                        ...episode,
                        podcastTitle: episode.podcastTitle,
                        podcastArtworkUrl: episode.podcastArtworkUrl,
                      })
                    }
                    className="flex-shrink-0 w-10 h-10 md:w-12 md:h-12 rounded-full bg-light-primary dark:bg-sky-600 text-white flex items-center justify-center hover:scale-105 transition-transform"
                  >
                    <Play className="w-4 h-4 md:w-5 md:h-5 ml-0.5" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
