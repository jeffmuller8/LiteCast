"use client";

import Image from "next/image";
import { Download, Play, Trash2 } from "lucide-react";
import { usePlayer } from "@/lib/player-context";
import { mockPodcasts, mockEpisodes, formatDuration } from "@/lib/mock-data";

// Simulate some downloaded episodes
const downloadedEpisodeIds = ["e1", "e3", "e5"];

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
    <div className="p-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold">Downloads</h1>
          <p className="text-zinc-400 mt-1">
            {downloads.length} episodes • {totalSize} MB
          </p>
        </div>
      </div>

      {downloads.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <Download className="w-16 h-16 text-zinc-700 mb-4" />
          <h2 className="text-xl font-semibold text-zinc-400">
            No downloads yet
          </h2>
          <p className="text-zinc-500 mt-2">
            Download episodes to listen offline
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {downloads.map((episode) => (
            <div
              key={episode.id}
              className="flex gap-4 p-4 rounded-xl bg-zinc-800/30 hover:bg-zinc-800/60 transition-colors group"
            >
              {/* Artwork */}
              <div className="relative w-16 h-16 flex-shrink-0">
                <Image
                  src={episode.podcastArtworkUrl}
                  alt={episode.title}
                  fill
                  className="rounded-lg object-cover"
                />
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <p className="text-xs text-purple-400 font-medium mb-1">
                  {episode.podcastTitle}
                </p>
                <h3 className="font-medium text-white line-clamp-1 group-hover:text-purple-300 transition-colors">
                  {episode.title}
                </h3>
                <div className="flex items-center gap-2 mt-1 text-sm text-zinc-400">
                  <span>{formatDuration(episode.duration)}</span>
                  <span>•</span>
                  <span>{episode.fileSize} MB</span>
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-2">
                <button className="p-2 text-zinc-400 hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100">
                  <Trash2 className="w-5 h-5" />
                </button>

                <button
                  onClick={() =>
                    play({
                      ...episode,
                      podcastTitle: episode.podcastTitle,
                      podcastArtworkUrl: episode.podcastArtworkUrl,
                    })
                  }
                  className="flex-shrink-0 w-12 h-12 rounded-full bg-white text-black flex items-center justify-center hover:scale-105 transition-transform"
                >
                  <Play className="w-5 h-5 ml-0.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
