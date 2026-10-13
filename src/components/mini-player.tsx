"use client";

import { useState, useEffect, useRef } from "react";
import { usePlayer } from "@/lib/player-context";
import { formatDuration } from "@/lib/mock-data";
import { Play, Pause, RotateCcw, RotateCw, Volume2, VolumeX, ListMusic, X, FileText, Loader2 } from "lucide-react";
import Link from "next/link";
import Image from "next/image";

interface TranscriptSegment {
  start: number;
  end: number;
  text: string;
}

export function MiniPlayer() {
  const {
    currentEpisode,
    isPlaying,
    currentTime,
    duration,
    volume,
    isMuted,
    queue,
    queueIndex,
    togglePlayPause,
    skipBackward,
    skipForward,
    setVolume,
    toggleMute,
    seekTo,
    play,
  } = usePlayer();

  const [showQueue, setShowQueue] = useState(false);
  const [showTranscript, setShowTranscript] = useState(false);
  const [transcript, setTranscript] = useState<TranscriptSegment[]>([]);
  const [isLoadingTranscript, setIsLoadingTranscript] = useState(false);
  const [transcriptError, setTranscriptError] = useState<string | null>(null);
  const transcriptRef = useRef<HTMLDivElement>(null);
  const activeSegmentRef = useRef<HTMLDivElement>(null);

  // Fetch transcript when opened
  useEffect(() => {
    if (showTranscript && currentEpisode?.transcriptUrl && transcript.length === 0) {
      setIsLoadingTranscript(true);
      setTranscriptError(null);

      fetch(`/api/transcript?url=${encodeURIComponent(currentEpisode.transcriptUrl)}`)
        .then((res) => res.json())
        .then((data) => {
          if (data.error) {
            setTranscriptError(data.error);
          } else {
            setTranscript(data.segments || []);
          }
        })
        .catch(() => {
          setTranscriptError("Failed to load transcript");
        })
        .finally(() => {
          setIsLoadingTranscript(false);
        });
    }
  }, [showTranscript, currentEpisode?.transcriptUrl, transcript.length]);

  // Clear transcript when episode changes
  useEffect(() => {
    setTranscript([]);
    setTranscriptError(null);
  }, [currentEpisode?.id]);

  // Auto-scroll to active segment
  useEffect(() => {
    if (activeSegmentRef.current && transcriptRef.current) {
      activeSegmentRef.current.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });
    }
  }, [currentTime]);

  // Find current active segment
  const activeSegmentIndex = transcript.findIndex(
    (seg) => currentTime >= seg.start && (seg.end === 0 || currentTime < seg.end)
  );

  if (!currentEpisode) return null;

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;
  const effectiveVolume = isMuted ? 0 : volume;
  const upcomingEpisodes = queue.slice(queueIndex + 1);

  const handleSeek = (e: React.MouseEvent<HTMLDivElement>) => {
    const bar = e.currentTarget;
    const rect = bar.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const percentage = clickX / rect.width;
    const newTime = percentage * duration;
    seekTo(Math.max(0, Math.min(newTime, duration)));
  };

  const handleSegmentClick = (startTime: number) => {
    seekTo(startTime);
  };

  const hasTranscript = !!currentEpisode.transcriptUrl;

  return (
    <div className="bg-zinc-900 border-t border-zinc-800 relative">
      {/* Queue Drawer */}
      {showQueue && (
        <div className="absolute bottom-full left-0 right-0 bg-zinc-900 border-t border-zinc-800 shadow-2xl max-h-80 overflow-hidden flex flex-col">
          <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800">
            <h3 className="font-semibold text-white flex items-center gap-2">
              <ListMusic className="w-5 h-5 text-purple-400" />
              Queue
              {upcomingEpisodes.length > 0 && (
                <span className="text-sm text-zinc-400">
                  ({upcomingEpisodes.length} upcoming)
                </span>
              )}
            </h3>
            <button
              onClick={() => setShowQueue(false)}
              className="p-1 text-zinc-400 hover:text-white transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="overflow-y-auto flex-1">
            {/* Now Playing */}
            <div className="px-4 py-2 bg-purple-500/10 border-b border-zinc-800">
              <p className="text-xs text-purple-400 font-medium mb-1">Now Playing</p>
              <div className="flex items-center gap-3">
                <Image
                  src={currentEpisode.podcastArtworkUrl}
                  alt={currentEpisode.title}
                  width={40}
                  height={40}
                  className="rounded"
                />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-white truncate">
                    {currentEpisode.title}
                  </p>
                  <p className="text-xs text-zinc-400 truncate">
                    {currentEpisode.podcastTitle}
                  </p>
                </div>
              </div>
            </div>

            {/* Upcoming */}
            {upcomingEpisodes.length > 0 ? (
              <div className="py-2">
                <p className="px-4 text-xs text-zinc-500 font-medium mb-2">Up Next</p>
                {upcomingEpisodes.map((episode, index) => (
                  <button
                    key={episode.id}
                    onClick={() => play(episode)}
                    className="w-full px-4 py-2 flex items-center gap-3 hover:bg-zinc-800/50 transition-colors"
                  >
                    <span className="text-sm text-zinc-500 w-5">{index + 1}</span>
                    <Image
                      src={episode.podcastArtworkUrl}
                      alt={episode.title}
                      width={36}
                      height={36}
                      className="rounded"
                    />
                    <div className="min-w-0 flex-1 text-left">
                      <p className="text-sm text-zinc-200 truncate">
                        {episode.title}
                      </p>
                      <p className="text-xs text-zinc-500 truncate">
                        {episode.podcastTitle}
                      </p>
                    </div>
                    <span className="text-xs text-zinc-500">
                      {formatDuration(episode.duration)}
                    </span>
                  </button>
                ))}
              </div>
            ) : (
              <div className="py-8 text-center text-zinc-500">
                <p className="text-sm">No more episodes in queue</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Transcript Panel */}
      {showTranscript && (
        <div className="absolute bottom-full left-0 right-0 bg-zinc-900 border-t border-zinc-800 shadow-2xl max-h-96 overflow-hidden flex flex-col">
          <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800">
            <h3 className="font-semibold text-white flex items-center gap-2">
              <FileText className="w-5 h-5 text-purple-400" />
              Transcript
            </h3>
            <button
              onClick={() => setShowTranscript(false)}
              className="p-1 text-zinc-400 hover:text-white transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div ref={transcriptRef} className="overflow-y-auto flex-1 p-4">
            {isLoadingTranscript ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-6 h-6 text-purple-400 animate-spin" />
                <span className="ml-2 text-zinc-400">Loading transcript...</span>
              </div>
            ) : transcriptError ? (
              <div className="text-center py-8 text-zinc-500">
                <p>{transcriptError}</p>
              </div>
            ) : transcript.length === 0 ? (
              <div className="text-center py-8 text-zinc-500">
                <p>No transcript available</p>
              </div>
            ) : (
              <div className="space-y-2">
                {transcript.map((segment, index) => (
                  <div
                    key={index}
                    ref={index === activeSegmentIndex ? activeSegmentRef : null}
                    onClick={() => handleSegmentClick(segment.start)}
                    className={`p-2 rounded cursor-pointer transition-colors ${
                      index === activeSegmentIndex
                        ? "bg-purple-500/20 text-white"
                        : "hover:bg-zinc-800 text-zinc-400"
                    }`}
                  >
                    <span className="text-xs text-purple-400 mr-2">
                      {formatDuration(Math.floor(segment.start))}
                    </span>
                    <span>{segment.text}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Progress bar - clickable */}
      <div
        className="h-2 bg-zinc-800 cursor-pointer group hover:h-3 transition-all"
        onClick={handleSeek}
      >
        <div
          className="h-full bg-purple-500 group-hover:bg-purple-400 transition-all relative"
          style={{ width: `${progress}%` }}
        >
          {/* Seek handle - visible on hover */}
          <div className="absolute right-0 top-1/2 -translate-y-1/2 w-3 h-3 bg-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity shadow-md" />
        </div>
      </div>

      <div className="flex items-center gap-4 p-3">
        {/* Episode info - left side */}
        <Link href="/player" className="flex items-center gap-3 flex-1 min-w-0">
          <Image
            src={currentEpisode.podcastArtworkUrl}
            alt={currentEpisode.title}
            width={48}
            height={48}
            className="rounded-md"
          />
          <div className="min-w-0">
            <p className="text-sm font-medium text-white truncate">
              {currentEpisode.title}
            </p>
            <p className="text-xs text-zinc-400 truncate">
              {currentEpisode.podcastTitle}
            </p>
          </div>
        </Link>

        {/* Centered playback controls with hover area for queue */}
        <div
          className="flex items-center gap-3 relative"
          onMouseEnter={() => setShowQueue(true)}
          onMouseLeave={() => setShowQueue(false)}
        >
          <button
            onClick={() => skipBackward(10)}
            className="p-2 text-zinc-400 hover:text-white transition-colors relative"
            title="Back 10 seconds"
          >
            <RotateCcw className="w-8 h-8" />
            <span className="absolute inset-0 flex items-center justify-center text-[11px] font-bold mt-0.5">
              10
            </span>
          </button>

          <button
            onClick={togglePlayPause}
            className="p-3 bg-white rounded-full text-black hover:scale-105 transition-transform"
          >
            {isPlaying ? (
              <Pause className="w-6 h-6" />
            ) : (
              <Play className="w-6 h-6 ml-0.5" />
            )}
          </button>

          <button
            onClick={() => skipForward(30)}
            className="p-2 text-zinc-400 hover:text-white transition-colors relative"
            title="Forward 30 seconds"
          >
            <RotateCw className="w-8 h-8" />
            <span className="absolute inset-0 flex items-center justify-center text-[11px] font-bold mt-0.5">
              30
            </span>
          </button>

          {/* Queue indicator */}
          {queue.length > 1 && (
            <div className="absolute -top-1 -right-1 w-4 h-4 bg-purple-500 rounded-full text-[10px] font-bold flex items-center justify-center text-white">
              {queue.length - queueIndex - 1 > 0 ? queue.length - queueIndex - 1 : ""}
            </div>
          )}
        </div>

        {/* Right side - time, transcript, and volume */}
        <div className="flex items-center gap-4 flex-1 justify-end">
          {/* Time */}
          <div className="text-xs text-zinc-400 hidden sm:block">
            {formatDuration(Math.floor(currentTime))} / {formatDuration(duration)}
          </div>

          {/* Transcript button */}
          {hasTranscript && (
            <button
              onClick={() => setShowTranscript(!showTranscript)}
              className={`p-1 transition-colors hidden sm:block ${
                showTranscript ? "text-purple-400" : "text-zinc-400 hover:text-white"
              }`}
              title="Show transcript"
            >
              <FileText className="w-5 h-5" />
            </button>
          )}

          {/* Volume controls */}
          <div className="flex items-center gap-2 hidden sm:flex">
            <button
              onClick={toggleMute}
              className="p-1 text-zinc-400 hover:text-white transition-colors"
              title={isMuted ? "Unmute" : "Mute"}
            >
              {isMuted || effectiveVolume === 0 ? (
                <VolumeX className="w-5 h-5" />
              ) : (
                <Volume2 className="w-5 h-5" />
              )}
            </button>
            <input
              type="range"
              min="0"
              max="1"
              step="0.01"
              value={effectiveVolume}
              onChange={(e) => setVolume(parseFloat(e.target.value))}
              className="w-20 h-1 bg-zinc-700 rounded-lg appearance-none cursor-pointer accent-purple-500
                [&::-webkit-slider-thumb]:appearance-none
                [&::-webkit-slider-thumb]:w-3
                [&::-webkit-slider-thumb]:h-3
                [&::-webkit-slider-thumb]:rounded-full
                [&::-webkit-slider-thumb]:bg-white
                [&::-webkit-slider-thumb]:cursor-pointer
                [&::-webkit-slider-thumb]:hover:bg-purple-400
                [&::-moz-range-thumb]:w-3
                [&::-moz-range-thumb]:h-3
                [&::-moz-range-thumb]:rounded-full
                [&::-moz-range-thumb]:bg-white
                [&::-moz-range-thumb]:border-0
                [&::-moz-range-thumb]:cursor-pointer"
              title={`Volume: ${Math.round(effectiveVolume * 100)}%`}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
