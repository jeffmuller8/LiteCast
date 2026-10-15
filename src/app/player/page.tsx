"use client";

import Image from "next/image";
import { usePlayer } from "@/lib/player-context";
import { formatDuration } from "@/lib/mock-data";

function getDurationParts(seconds: number): { hours: number; minutes: number } {
  if (!seconds || seconds <= 0) return { hours: 0, minutes: 0 };
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  return { hours, minutes };
}

function DurationLabel({ seconds }: { seconds: number }) {
  const { hours, minutes } = getDurationParts(seconds);
  return (
    <span>
      {hours > 0 && (
        <>
          <span className="font-semibold text-gray-600 dark:text-zinc-400">{hours}</span>
          <span className="ml-0.5">hr</span>
        </>
      )}
      <span className={`font-semibold text-gray-600 dark:text-zinc-400 ${hours > 0 ? "ml-1" : ""}`}>{minutes}</span>
      <span className="ml-0.5">min</span>
    </span>
  );
}
import {
  X,
  Play,
  Pause,
  RotateCcw,
  RotateCw,
  Volume2,
  Moon,
  ListMusic,
  Share2,
} from "lucide-react";
import { useState } from "react";
import { useRouter } from "next/navigation";

const speeds = [0.5, 0.75, 1, 1.25, 1.5, 1.75, 2];

export default function PlayerPage() {
  const {
    currentEpisode,
    isPlaying,
    currentTime,
    duration,
    playbackSpeed,
    queue,
    queueIndex,
    togglePlayPause,
    seekTo,
    skipForward,
    skipBackward,
    setPlaybackSpeed,
    play,
  } = usePlayer();

  const upcomingEpisodes = queue.slice(queueIndex + 1);
  const router = useRouter();

  const [showSpeedMenu, setShowSpeedMenu] = useState(false);
  const [isQueueHovered, setIsQueueHovered] = useState(false);

  if (!currentEpisode) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-8">
        <p className="text-xl text-zinc-400">No episode playing</p>
        <button
          onClick={() => router.back()}
          className="mt-4 text-light-primary dark:text-sky-400 hover:text-light-primary/80 dark:hover:text-sky-300 transition-colors"
        >
          Go back
        </button>
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
    <div className="flex h-full overflow-hidden">
      {/* Main Player Content */}
      <div className="flex-1 flex flex-col items-center pt-14 px-4 pb-4 md:justify-center md:p-8 transition-all duration-300 overflow-y-auto md:overflow-hidden">
        {/* Close button */}
        <button
          onClick={() => router.back()}
          className={`absolute top-4 z-10 p-2 text-gray-400 dark:text-zinc-400 hover:text-light-primary dark:hover:text-sky-400 transition-colors rounded-full hover:bg-gray-200 dark:hover:bg-zinc-800 ${
            isQueueHovered ? 'hidden md:block right-4' : 'right-4 md:right-40'
          }`}
        >
          <X className="w-6 h-6" />
        </button>

        {/* Artwork */}
        <div className="relative flex-shrink-0 w-48 h-48 md:w-72 md:h-72 mb-6 md:mb-8 shadow-2xl rounded-2xl overflow-hidden">
          <Image
            src={currentEpisode.podcastArtworkUrl}
            alt={currentEpisode.title}
            fill
            className="object-cover"
          />
        </div>

        {/* Episode info */}
        <div className="text-center mb-6 md:mb-8 max-w-lg px-4">
          <h1 className="text-xl md:text-2xl font-bold mb-2 line-clamp-2">
            {currentEpisode.title}
          </h1>
          <p className="text-zinc-400 text-sm md:text-base">{currentEpisode.podcastTitle}</p>
        </div>

        {/* Progress bar - Gold scrubber */}
        <div className="w-full max-w-lg mb-4 px-4 md:px-0">
          <div
            className="h-2 bg-gray-300 dark:bg-zinc-800 rounded-full cursor-pointer group hover:h-3 transition-all"
            onClick={handleSeek}
          >
            <div
              className="h-full rounded-full relative transition-all overflow-hidden"
              style={{ width: `${progress}%` }}
            >
              {/* Gold gradient */}
              <div
                className="absolute inset-0"
                style={{
                  background: 'linear-gradient(90deg, #D1D5DB 0%, #D18D04 100%)',
                }}
              />
              <div
                className="absolute inset-0 dark:block hidden"
                style={{
                  background: 'linear-gradient(90deg, #27272a 0%, #D18D04 100%)',
                }}
              />
              {/* Seek handle */}
              <div className="absolute right-0 top-1/2 -translate-y-1/2 w-4 h-4 bg-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity shadow-lg border-2 border-amber-500" />
            </div>
          </div>
          <div className="flex justify-between mt-2 text-sm text-gray-500 dark:text-zinc-400">
            <span>{formatDuration(Math.floor(currentTime))}</span>
            <span>{formatDuration(duration)}</span>
          </div>
        </div>

        {/* Main controls */}
        <div className="flex items-center gap-6 mb-8">
          <button
            onClick={() => skipBackward(10)}
            className="p-2 text-gray-500 dark:text-zinc-400 hover:text-light-primary dark:hover:text-sky-400 transition-colors relative"
            title="Back 10 seconds"
          >
            <RotateCcw className="w-10 h-10" />
            <span className="absolute inset-0 flex items-center justify-center text-sm font-bold mt-0.5">
              10
            </span>
          </button>

          <button
            onClick={togglePlayPause}
            className="w-16 h-16 bg-light-primary dark:bg-sky-600 rounded-full flex items-center justify-center text-white hover:scale-105 hover:bg-light-primary/90 dark:hover:bg-sky-500 transition-all"
          >
            {isPlaying ? (
              <Pause className="w-7 h-7" />
            ) : (
              <Play className="w-7 h-7 ml-1" />
            )}
          </button>

          <button
            onClick={() => skipForward(30)}
            className="p-2 text-gray-500 dark:text-zinc-400 hover:text-light-primary dark:hover:text-sky-400 transition-colors relative"
            title="Forward 30 seconds"
          >
            <RotateCw className="w-10 h-10" />
            <span className="absolute inset-0 flex items-center justify-center text-sm font-bold mt-0.5">
              30
            </span>
          </button>
        </div>

        {/* Secondary controls */}
        <div className="flex items-center gap-6">
          {/* Speed */}
          <div className="relative">
            <button
              onClick={() => setShowSpeedMenu(!showSpeedMenu)}
              className="px-3 py-1.5 text-sm font-medium text-gray-500 dark:text-zinc-400 hover:text-light-primary dark:hover:text-sky-400 bg-gray-200 dark:bg-zinc-800 rounded-full transition-colors"
            >
              {playbackSpeed}x
            </button>
            {showSpeedMenu && (
              <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 bg-white dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded-xl p-2 shadow-xl">
                {speeds.map((speed) => (
                  <button
                    key={speed}
                    onClick={() => {
                      setPlaybackSpeed(speed);
                      setShowSpeedMenu(false);
                    }}
                    className={`block w-full px-4 py-2 text-sm rounded-lg transition-colors ${
                      playbackSpeed === speed
                        ? "bg-light-primary dark:bg-sky-600 text-white"
                        : "text-gray-600 dark:text-zinc-300 hover:bg-gray-100 dark:hover:bg-zinc-700"
                    }`}
                  >
                    {speed}x
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Sleep timer */}
          <button className="p-2 text-gray-500 dark:text-zinc-400 hover:text-light-primary dark:hover:text-sky-400 transition-colors">
            <Moon className="w-5 h-5" />
          </button>

          {/* Share */}
          <button className="p-2 text-gray-500 dark:text-zinc-400 hover:text-light-primary dark:hover:text-sky-400 transition-colors">
            <Share2 className="w-5 h-5" />
          </button>

          {/* Volume */}
          <button className="p-2 text-gray-500 dark:text-zinc-400 hover:text-light-primary dark:hover:text-sky-400 transition-colors">
            <Volume2 className="w-5 h-5" />
          </button>
        </div>

        {/* Queue - below the controls on mobile (desktop uses the sidebar) */}
        <section className="md:hidden w-full max-w-lg mt-8 pt-6 border-t border-gray-200 dark:border-zinc-800">
          <h3 className="text-sm font-semibold text-gray-800 dark:text-white mb-3 flex items-center gap-2">
            <ListMusic className="w-4 h-4 text-light-primary dark:text-sky-400" />
            Queue ({upcomingEpisodes.length})
          </h3>
          {upcomingEpisodes.length > 0 ? (
            <div className="space-y-1">
              {upcomingEpisodes.map((episode) => (
                <button
                  key={episode.id}
                  onClick={() => play(episode)}
                  className="w-full flex items-center gap-3 p-2 rounded-xl text-left transition-colors active:bg-gray-100 dark:active:bg-zinc-800"
                >
                  <div className="relative w-12 h-12 rounded-lg overflow-hidden shadow-md flex-shrink-0">
                    <Image
                      src={episode.podcastArtworkUrl}
                      alt={episode.title}
                      fill
                      className="object-cover"
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-800 dark:text-zinc-200 line-clamp-2 leading-tight">
                      {episode.title}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-zinc-500 mt-1 truncate">
                      {episode.podcastTitle}
                    </p>
                  </div>
                  <span className="text-xs text-gray-400 dark:text-zinc-500 flex-shrink-0">
                    <DurationLabel seconds={episode.duration} />
                  </span>
                </button>
              ))}
            </div>
          ) : (
            <div className="text-center py-6">
              <p className="text-sm text-gray-400 dark:text-zinc-500">Queue is empty</p>
              <p className="text-xs text-gray-400 dark:text-zinc-600 mt-1">Use &quot;Play All&quot; to add episodes</p>
            </div>
          )}
        </section>
      </div>

      {/* Queue Sidebar - Hidden on mobile, expands on hover on desktop */}
      <div
        className={`hidden md:block relative border-l border-gray-200 dark:border-zinc-800 overflow-hidden transition-all duration-300 ease-out ${
          isQueueHovered ? 'w-80' : 'w-36'
        } bg-gray-50/50 dark:bg-zinc-900/50`}
        onMouseEnter={() => setIsQueueHovered(true)}
        onMouseLeave={() => setIsQueueHovered(false)}
      >
        {/* Queue Content - always visible */}
        <div className="h-full overflow-y-auto p-4">
          {/* Title always at full opacity */}
          <h3 className="text-sm font-semibold text-gray-800 dark:text-white mb-4 flex items-center gap-2 whitespace-nowrap">
            <ListMusic className="w-4 h-4 text-light-primary dark:text-sky-400" />
            Queue ({upcomingEpisodes.length})
          </h3>
          {/* List fades when collapsed */}
          <div className={`transition-opacity duration-300 ${isQueueHovered ? 'opacity-100' : 'opacity-40'}`}>
          {upcomingEpisodes.length > 0 ? (
            <div className="space-y-3">
              {upcomingEpisodes.map((episode) => (
                <button
                  key={episode.id}
                  onClick={() => play(episode)}
                  disabled={!isQueueHovered}
                  className={`w-full flex items-center gap-3 p-2 rounded-xl transition-all duration-300 group ${
                    isQueueHovered
                      ? 'grayscale opacity-50 hover:grayscale-0 hover:opacity-100 hover:bg-gray-100 dark:hover:bg-zinc-800 cursor-pointer'
                      : 'grayscale cursor-default'
                  }`}
                >
                  <div className="relative w-14 h-14 rounded-lg overflow-hidden shadow-md flex-shrink-0">
                    <Image
                      src={episode.podcastArtworkUrl}
                      alt={episode.title}
                      fill
                      className="object-cover"
                    />
                  </div>
                  <div className="flex-1 min-w-0 text-left">
                    <p className={`text-sm font-medium text-gray-700 dark:text-zinc-300 group-hover:text-light-primary dark:group-hover:text-sky-400 transition-colors ${isQueueHovered ? 'leading-tight' : 'truncate'}`}>
                      {episode.title}
                    </p>
                    <p className={`text-xs text-gray-500 dark:text-zinc-500 mt-1 ${isQueueHovered ? '' : 'truncate'}`}>
                      {episode.podcastTitle}
                    </p>
                    <p className="text-xs text-gray-400 dark:text-zinc-600 mt-0.5">
                      <DurationLabel seconds={episode.duration} />
                    </p>
                  </div>
                </button>
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <p className="text-sm text-gray-400 dark:text-zinc-500">Queue is empty</p>
              <p className="text-xs text-gray-400 dark:text-zinc-600 mt-1">Use &quot;Play All&quot; to add episodes</p>
            </div>
          )}
          </div>
        </div>
      </div>
    </div>
  );
}
