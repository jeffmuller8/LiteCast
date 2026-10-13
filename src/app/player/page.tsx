"use client";

import Image from "next/image";
import Link from "next/link";
import { usePlayer } from "@/lib/player-context";
import { formatDuration } from "@/lib/mock-data";
import {
  ArrowLeft,
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Volume2,
  Moon,
  ListMusic,
  Share2,
} from "lucide-react";
import { useState } from "react";

const speeds = [0.5, 0.75, 1, 1.25, 1.5, 1.75, 2];

export default function PlayerPage() {
  const {
    currentEpisode,
    isPlaying,
    currentTime,
    duration,
    playbackSpeed,
    togglePlayPause,
    seekTo,
    skipForward,
    skipBackward,
    setPlaybackSpeed,
  } = usePlayer();

  const [showSpeedMenu, setShowSpeedMenu] = useState(false);

  if (!currentEpisode) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-8">
        <p className="text-xl text-zinc-400">No episode playing</p>
        <Link
          href="/"
          className="mt-4 text-purple-400 hover:text-purple-300 transition-colors"
        >
          Browse podcasts
        </Link>
      </div>
    );
  }

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

  const handleSeek = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const percent = (e.clientX - rect.left) / rect.width;
    seekTo(percent * duration);
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-full p-8">
      {/* Back button */}
      <div className="absolute top-4 left-4">
        <Link
          href="/"
          className="p-2 text-zinc-400 hover:text-white transition-colors rounded-lg hover:bg-zinc-800"
        >
          <ArrowLeft className="w-6 h-6" />
        </Link>
      </div>

      {/* Artwork */}
      <div className="relative w-72 h-72 mb-8 shadow-2xl rounded-2xl overflow-hidden">
        <Image
          src={currentEpisode.podcastArtworkUrl}
          alt={currentEpisode.title}
          fill
          className="object-cover"
        />
      </div>

      {/* Episode info */}
      <div className="text-center mb-8 max-w-lg">
        <h1 className="text-2xl font-bold mb-2 line-clamp-2">
          {currentEpisode.title}
        </h1>
        <p className="text-zinc-400">{currentEpisode.podcastTitle}</p>
      </div>

      {/* Progress bar */}
      <div className="w-full max-w-lg mb-4">
        <div
          className="h-2 bg-zinc-800 rounded-full cursor-pointer group"
          onClick={handleSeek}
        >
          <div
            className="h-full bg-purple-500 rounded-full relative group-hover:bg-purple-400 transition-colors"
            style={{ width: `${progress}%` }}
          >
            <div className="absolute right-0 top-1/2 -translate-y-1/2 w-4 h-4 bg-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity shadow-lg" />
          </div>
        </div>
        <div className="flex justify-between mt-2 text-sm text-zinc-400">
          <span>{formatDuration(Math.floor(currentTime))}</span>
          <span>{formatDuration(duration)}</span>
        </div>
      </div>

      {/* Main controls */}
      <div className="flex items-center gap-6 mb-8">
        <button
          onClick={() => skipBackward(10)}
          className="p-3 text-zinc-400 hover:text-white transition-colors"
        >
          <div className="relative">
            <SkipBack className="w-8 h-8" />
            <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 text-[10px] font-bold">
              10
            </span>
          </div>
        </button>

        <button
          onClick={togglePlayPause}
          className="w-16 h-16 bg-white rounded-full flex items-center justify-center text-black hover:scale-105 transition-transform"
        >
          {isPlaying ? (
            <Pause className="w-7 h-7" />
          ) : (
            <Play className="w-7 h-7 ml-1" />
          )}
        </button>

        <button
          onClick={() => skipForward(30)}
          className="p-3 text-zinc-400 hover:text-white transition-colors"
        >
          <div className="relative">
            <SkipForward className="w-8 h-8" />
            <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 text-[10px] font-bold">
              30
            </span>
          </div>
        </button>
      </div>

      {/* Secondary controls */}
      <div className="flex items-center gap-6">
        {/* Speed */}
        <div className="relative">
          <button
            onClick={() => setShowSpeedMenu(!showSpeedMenu)}
            className="px-3 py-1.5 text-sm font-medium text-zinc-400 hover:text-white bg-zinc-800 rounded-full transition-colors"
          >
            {playbackSpeed}x
          </button>
          {showSpeedMenu && (
            <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 bg-zinc-800 rounded-xl p-2 shadow-xl">
              {speeds.map((speed) => (
                <button
                  key={speed}
                  onClick={() => {
                    setPlaybackSpeed(speed);
                    setShowSpeedMenu(false);
                  }}
                  className={`block w-full px-4 py-2 text-sm rounded-lg transition-colors ${
                    playbackSpeed === speed
                      ? "bg-purple-600 text-white"
                      : "text-zinc-300 hover:bg-zinc-700"
                  }`}
                >
                  {speed}x
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Sleep timer */}
        <button className="p-2 text-zinc-400 hover:text-white transition-colors">
          <Moon className="w-5 h-5" />
        </button>

        {/* Queue */}
        <button className="p-2 text-zinc-400 hover:text-white transition-colors">
          <ListMusic className="w-5 h-5" />
        </button>

        {/* Share */}
        <button className="p-2 text-zinc-400 hover:text-white transition-colors">
          <Share2 className="w-5 h-5" />
        </button>

        {/* Volume */}
        <button className="p-2 text-zinc-400 hover:text-white transition-colors">
          <Volume2 className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
}
