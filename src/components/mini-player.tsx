"use client";

import { useState, useEffect, useRef } from "react";
import { usePathname, useRouter } from "next/navigation";
import { usePlayer } from "@/lib/player-context";
import { useSubscriptions } from "@/lib/subscription-context";
import { formatDuration } from "@/lib/mock-data";
import { Play, Pause, RotateCcw, RotateCw, Volume2, VolumeX, ListMusic, X, FileText, Loader2, ChevronUp, ChevronDown, Maximize2 } from "lucide-react";
import Link from "next/link";
import Image from "next/image";

interface TranscriptSegment {
  start: number;
  end: number;
  text: string;
}

export function MiniPlayer() {
  const pathname = usePathname();
  const router = useRouter();
  const {
    currentEpisode,
    isPlaying,
    currentTime,
    duration,
    volume,
    isMuted,
    playbackSpeed,
    queue,
    queueIndex,
    togglePlayPause,
    skipBackward,
    skipForward,
    setVolume,
    toggleMute,
    setPlaybackSpeed,
    seekTo,
    play,
  } = usePlayer();
  const { recordPlay } = useSubscriptions();

  // All hooks must be called before any early returns
  const [showQueue, setShowQueue] = useState(false);
  const lastRecordedEpisodeRef = useRef<string | null>(null);
  const [showTranscript, setShowTranscript] = useState(false);
  const [showSpeedMenu, setShowSpeedMenu] = useState(false);
  const [mobileExpanded, setMobileExpanded] = useState(true);

  const speedOptions = [2, 1.5, 1.25, 1, 0.5];
  const [transcript, setTranscript] = useState<TranscriptSegment[]>([]);
  const [isLoadingTranscript, setIsLoadingTranscript] = useState(false);
  const [transcriptError, setTranscriptError] = useState<string | null>(null);
  const transcriptRef = useRef<HTMLDivElement>(null);
  const activeSegmentRef = useRef<HTMLDivElement>(null);
  const speedMenuRef = useRef<HTMLDivElement>(null);

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

  // Track plays for "Most Listened" feature
  useEffect(() => {
    if (currentEpisode && isPlaying && currentEpisode.podcastId) {
      // Only record once per episode play session
      if (lastRecordedEpisodeRef.current !== currentEpisode.id) {
        lastRecordedEpisodeRef.current = currentEpisode.id;
        // Record estimated duration (will be refined as user listens)
        recordPlay(currentEpisode.podcastId, currentEpisode.duration || 1800);
      }
    }
  }, [currentEpisode?.id, isPlaying, currentEpisode?.podcastId, currentEpisode?.duration, recordPlay]);

  // Auto-scroll to active segment
  useEffect(() => {
    if (activeSegmentRef.current && transcriptRef.current) {
      activeSegmentRef.current.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });
    }
  }, [currentTime]);

  // Close speed menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (speedMenuRef.current && !speedMenuRef.current.contains(e.target as Node)) {
        setShowSpeedMenu(false);
      }
    };
    if (showSpeedMenu) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [showSpeedMenu]);

  // Find current active segment
  const activeSegmentIndex = transcript.findIndex(
    (seg) => currentTime >= seg.start && (seg.end === 0 || currentTime < seg.end)
  );

  // Hide mini-player on full-screen player page or if no episode
  if (pathname === "/player" || !currentEpisode) return null;

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

  // Mobile expanded player view
  const renderMobileExpanded = () => (
    <>
      {/* Queue Sliding Drawer for Mobile - renders outside mini-player */}
      {showQueue && (
        <>
          {/* Overlay - stops above the mini-player */}
          <div
            className="md:hidden fixed inset-0 bottom-[180px] bg-black/50 z-40 animate-fadeIn"
            onClick={() => setShowQueue(false)}
          />
          {/* Sliding Drawer */}
          <div className="md:hidden fixed left-0 right-0 bottom-[180px] bg-light-surface dark:bg-zinc-900 border-t border-gray-200 dark:border-zinc-800 shadow-2xl max-h-[60vh] overflow-hidden flex flex-col rounded-t-2xl z-50 animate-slideUp">
            {/* Drag handle */}
            <div className="flex justify-center py-2">
              <div className="w-10 h-1 bg-gray-300 dark:bg-zinc-600 rounded-full" />
            </div>

            <div className="flex items-center justify-between px-4 pb-3 border-b border-gray-200 dark:border-zinc-800">
              <h3 className="font-semibold text-light-text dark:text-white flex items-center gap-2">
                <ListMusic className="w-5 h-5 text-light-primary dark:text-sky-400" />
                Queue
                {upcomingEpisodes.length > 0 && (
                  <span className="text-sm text-gray-500 dark:text-zinc-400">
                    ({upcomingEpisodes.length} upcoming)
                  </span>
                )}
              </h3>
              <button
                onClick={() => setShowQueue(false)}
                className="p-1 text-gray-500 dark:text-zinc-400 hover:text-light-text dark:hover:text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="overflow-y-auto flex-1">
              {/* Now Playing */}
              <div className="px-4 py-3 bg-light-primary/10 dark:bg-sky-500/10 border-b border-gray-200 dark:border-zinc-800">
                <p className="text-xs text-light-primary dark:text-sky-400 font-medium mb-2">Now Playing</p>
                <div className="flex items-center gap-3">
                  <Image
                    src={currentEpisode.podcastArtworkUrl}
                    alt={currentEpisode.title}
                    width={48}
                    height={48}
                    className="rounded-lg"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-light-text dark:text-white truncate">
                      {currentEpisode.title}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-zinc-400 truncate">
                      {currentEpisode.podcastTitle}
                    </p>
                  </div>
                </div>
              </div>

              {/* Upcoming */}
              {upcomingEpisodes.length > 0 ? (
                <div className="py-2">
                  <p className="px-4 text-xs text-gray-500 dark:text-zinc-500 font-medium mb-2">Up Next</p>
                  {upcomingEpisodes.map((episode, index) => (
                    <button
                      key={episode.id}
                      onClick={() => play(episode)}
                      className="w-full px-4 py-3 flex items-center gap-3 active:bg-gray-200 dark:active:bg-zinc-800/50 transition-colors"
                    >
                      <span className="text-sm text-gray-500 dark:text-zinc-500 w-5">{index + 1}</span>
                      <Image
                        src={episode.podcastArtworkUrl}
                        alt={episode.title}
                        width={40}
                        height={40}
                        className="rounded-lg"
                      />
                      <div className="min-w-0 flex-1 text-left">
                        <p className="text-sm text-light-text dark:text-zinc-200 truncate">
                          {episode.title}
                        </p>
                        <p className="text-xs text-gray-500 dark:text-zinc-500 truncate">
                          {episode.podcastTitle}
                        </p>
                      </div>
                      <span className="text-xs text-gray-500 dark:text-zinc-500">
                        {formatDuration(episode.duration)}
                      </span>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="py-8 text-center text-gray-500 dark:text-zinc-500">
                  <p className="text-sm">No more episodes in queue</p>
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {/* Mini Player */}
      <div className="md:hidden bg-light-surface dark:bg-zinc-900 border-t border-gray-200 dark:border-zinc-800 fixed bottom-16 left-0 right-0 z-50">

      {/* Episode Info Row */}
      <div className="flex items-center gap-3 p-3 border-b border-gray-100 dark:border-zinc-800">
        <button
          onClick={() => router.push("/player")}
          className="relative"
        >
          <Image
            src={currentEpisode.podcastArtworkUrl}
            alt={currentEpisode.title}
            width={56}
            height={56}
            className="rounded-lg"
          />
          <div className="absolute inset-0 flex items-center justify-center bg-black/30 rounded-lg opacity-0 hover:opacity-100 transition-opacity">
            <Maximize2 className="w-5 h-5 text-white" />
          </div>
        </button>
        <div className="flex-1 min-w-0" onClick={() => router.push("/player")}>
          <p className="text-sm font-medium text-light-text dark:text-white truncate">
            {currentEpisode.title}
          </p>
          <p className="text-xs text-gray-500 dark:text-zinc-400 truncate">
            {currentEpisode.podcastTitle}
          </p>
        </div>
        <div className="text-xs text-gray-500 dark:text-zinc-400 text-right">
          <div>{formatDuration(Math.floor(currentTime))}</div>
          <div className="text-gray-400 dark:text-zinc-500">/ {formatDuration(duration)}</div>
        </div>
      </div>

      {/* Progress bar */}
      <div
        className="h-2 bg-gray-300 dark:bg-zinc-800 cursor-pointer"
        onClick={handleSeek}
      >
        <div
          className="h-full relative transition-all overflow-hidden"
          style={{ width: `${progress}%` }}
        >
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
        </div>
      </div>

      {/* Main Controls Row */}
      <div className="flex items-center justify-between px-4 py-3">
        {/* Skip Back */}
        <button
          onClick={() => skipBackward(10)}
          className="p-2 text-gray-500 dark:text-zinc-400 hover:text-light-primary dark:hover:text-sky-400 transition-colors relative"
        >
          <RotateCcw className="w-7 h-7" />
          <span className="absolute inset-0 flex items-center justify-center text-[10px] font-bold mt-0.5">
            10
          </span>
        </button>

        {/* Play/Pause */}
        <button
          onClick={togglePlayPause}
          className="p-3 bg-light-primary dark:bg-sky-600 rounded-full text-white hover:scale-105 transition-all"
        >
          {isPlaying ? (
            <Pause className="w-6 h-6" />
          ) : (
            <Play className="w-6 h-6 ml-0.5" />
          )}
        </button>

        {/* Skip Forward */}
        <button
          onClick={() => skipForward(30)}
          className="p-2 text-gray-500 dark:text-zinc-400 hover:text-light-primary dark:hover:text-sky-400 transition-colors relative"
        >
          <RotateCw className="w-7 h-7" />
          <span className="absolute inset-0 flex items-center justify-center text-[10px] font-bold mt-0.5">
            30
          </span>
        </button>
      </div>

      {/* Secondary Controls Row */}
      <div className="flex items-center justify-around px-4 py-2 border-t border-gray-100 dark:border-zinc-800">
        {/* Speed */}
        <div ref={speedMenuRef} className="relative">
          <button
            onClick={() => setShowSpeedMenu(!showSpeedMenu)}
            className="px-3 py-1.5 text-sm font-medium text-gray-600 dark:text-zinc-400 bg-gray-100 dark:bg-zinc-800 rounded-full"
          >
            {playbackSpeed}x
          </button>
          {showSpeedMenu && (
            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 bg-light-surface dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded-lg shadow-lg overflow-hidden">
              {speedOptions.map((speed) => (
                <button
                  key={speed}
                  onClick={() => {
                    setPlaybackSpeed(speed);
                    setShowSpeedMenu(false);
                  }}
                  className={`block w-full px-4 py-2 text-sm text-left transition-colors ${
                    playbackSpeed === speed
                      ? "bg-light-primary/10 dark:bg-sky-500/20 text-light-primary dark:text-sky-400"
                      : "text-gray-600 dark:text-zinc-300 hover:bg-gray-100 dark:hover:bg-zinc-700"
                  }`}
                >
                  {speed}x
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Volume */}
        <button
          onClick={toggleMute}
          className="p-2 text-gray-500 dark:text-zinc-400 hover:text-light-primary dark:hover:text-sky-400 transition-colors"
        >
          {isMuted || effectiveVolume === 0 ? (
            <VolumeX className="w-5 h-5" />
          ) : (
            <Volume2 className="w-5 h-5" />
          )}
        </button>

        {/* Queue */}
        <button
          onClick={() => setShowQueue(!showQueue)}
          className={`flex items-center gap-1 px-3 py-1.5 text-sm rounded-full transition-colors ${
            showQueue
              ? "text-light-primary dark:text-sky-400 bg-light-primary/10 dark:bg-sky-500/10"
              : "text-gray-600 dark:text-zinc-400 bg-gray-100 dark:bg-zinc-800"
          }`}
        >
          <ListMusic className="w-4 h-4" />
          <span>Queue</span>
          {upcomingEpisodes.length > 0 && (
            <span className="text-xs opacity-70">({upcomingEpisodes.length})</span>
          )}
        </button>
      </div>
      </div>
    </>
  );

  // Desktop player view (unchanged from original)
  const renderDesktop = () => (
    <div className="hidden md:block bg-light-surface dark:bg-zinc-900 border-t border-gray-200 dark:border-zinc-800 relative z-50">
      {/* Queue Drawer */}
      {showQueue && (
        <div className="absolute bottom-full left-0 right-0 bg-light-surface dark:bg-zinc-900 border-t border-gray-200 dark:border-zinc-800 shadow-2xl max-h-80 overflow-hidden flex flex-col rounded-t-2xl">
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-zinc-800">
          <h3 className="font-semibold text-light-text dark:text-white flex items-center gap-2">
            <ListMusic className="w-5 h-5 text-light-primary dark:text-sky-400" />
            Queue
            {upcomingEpisodes.length > 0 && (
              <span className="text-sm text-gray-500 dark:text-zinc-400">
                ({upcomingEpisodes.length} upcoming)
              </span>
            )}
          </h3>
          <button
            onClick={() => setShowQueue(false)}
            className="p-1 text-gray-500 dark:text-zinc-400 hover:text-light-text dark:hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="overflow-y-auto flex-1">
          {/* Now Playing */}
          <div className="px-4 py-2 bg-light-primary/10 dark:bg-sky-500/10 border-b border-gray-200 dark:border-zinc-800">
            <p className="text-xs text-light-primary dark:text-sky-400 font-medium mb-1">Now Playing</p>
            <div className="flex items-center gap-3">
              <Image
                src={currentEpisode.podcastArtworkUrl}
                alt={currentEpisode.title}
                width={40}
                height={40}
                className="rounded"
              />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-light-text dark:text-white truncate">
                  {currentEpisode.title}
                </p>
                <p className="text-xs text-gray-500 dark:text-zinc-400 truncate">
                  {currentEpisode.podcastTitle}
                </p>
              </div>
            </div>
          </div>

          {/* Upcoming */}
          {upcomingEpisodes.length > 0 ? (
            <div className="py-2">
              <p className="px-4 text-xs text-gray-500 dark:text-zinc-500 font-medium mb-2">Up Next</p>
              {upcomingEpisodes.map((episode, index) => (
                <button
                  key={episode.id}
                  onClick={() => play(episode)}
                  className="w-full px-4 py-2 flex items-center gap-3 hover:bg-gray-200 dark:hover:bg-zinc-800/50 transition-colors"
                >
                  <span className="text-sm text-gray-500 dark:text-zinc-500 w-5">{index + 1}</span>
                  <Image
                    src={episode.podcastArtworkUrl}
                    alt={episode.title}
                    width={36}
                    height={36}
                    className="rounded"
                  />
                  <div className="min-w-0 flex-1 text-left">
                    <p className="text-sm text-light-text dark:text-zinc-200 truncate">
                      {episode.title}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-zinc-500 truncate">
                      {episode.podcastTitle}
                    </p>
                  </div>
                  <span className="text-xs text-gray-500 dark:text-zinc-500">
                    {formatDuration(episode.duration)}
                  </span>
                </button>
              ))}
            </div>
          ) : (
            <div className="py-8 text-center text-gray-500 dark:text-zinc-500">
              <p className="text-sm">No more episodes in queue</p>
            </div>
          )}
        </div>
      </div>
    )}

    {/* Transcript Panel */}
    {showTranscript && (
      <div className="absolute bottom-full left-0 right-0 bg-light-surface dark:bg-zinc-900 border-t border-gray-200 dark:border-zinc-800 shadow-2xl max-h-96 overflow-hidden flex flex-col rounded-t-2xl">
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-zinc-800">
          <h3 className="font-semibold text-light-text dark:text-white flex items-center gap-2">
            <FileText className="w-5 h-5 text-light-primary dark:text-sky-400" />
            Transcript
          </h3>
          <button
            onClick={() => setShowTranscript(false)}
            className="p-1 text-gray-500 dark:text-zinc-400 hover:text-light-text dark:hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div ref={transcriptRef} className="overflow-y-auto flex-1 p-4">
          {isLoadingTranscript ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 text-light-primary dark:text-sky-400 animate-spin" />
              <span className="ml-2 text-gray-500 dark:text-zinc-400">Loading transcript...</span>
            </div>
          ) : transcriptError ? (
            <div className="text-center py-8 text-gray-500 dark:text-zinc-500">
              <p>{transcriptError}</p>
            </div>
          ) : transcript.length === 0 ? (
            <div className="text-center py-8 text-gray-500 dark:text-zinc-500">
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
                      ? "bg-light-primary/20 dark:bg-sky-500/20 text-light-text dark:text-white"
                      : "hover:bg-gray-200 dark:hover:bg-zinc-800 text-gray-600 dark:text-zinc-400"
                  }`}
                >
                  <span className="text-xs text-light-primary dark:text-sky-400 mr-2">
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

      {/* Overlay */}
      {(showQueue || showTranscript) && (
        <div
          className="fixed inset-0 bg-black/50 z-40 animate-fadeIn"
          onClick={() => {
            setShowQueue(false);
            setShowTranscript(false);
          }}
        />
      )}

      {/* Progress bar - clickable */}
      <div
        className="h-2 bg-gray-300 dark:bg-zinc-800 cursor-pointer group hover:h-3 transition-all"
        onClick={handleSeek}
      >
        <div
          className="h-full relative transition-all overflow-hidden bg-gray-300 dark:bg-zinc-800"
          style={{ width: `${progress}%` }}
        >
          {/* Grey to gold gradient overlay */}
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
          {/* Animated gold pulse effect */}
          <div
            className="absolute inset-0 animate-shimmer"
            style={{
              background: 'linear-gradient(90deg, transparent 0%, rgba(209, 141, 4, 0.4) 50%, transparent 100%)',
              backgroundSize: '200% 100%',
            }}
          />
          {/* Seek handle - visible on hover */}
          <div className="absolute right-0 top-1/2 -translate-y-1/2 w-3 h-3 bg-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity shadow-md border-2 border-light-gold dark:border-yellow-500" />
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
            className="rounded-md w-12 h-12"
          />
          <div className="min-w-0">
            <p className="text-sm font-medium text-light-text dark:text-white truncate">
              {currentEpisode.title}
            </p>
            <p className="text-xs text-gray-500 dark:text-zinc-400 truncate">
              {currentEpisode.podcastTitle}
            </p>
          </div>
        </Link>

        {/* Centered playback controls */}
        <div className="flex flex-col items-center gap-2 relative">
          {/* Queue toggle button */}
          <button
            onClick={() => setShowQueue(!showQueue)}
            className={`flex items-center gap-1 px-2 py-0.5 text-xs rounded-full transition-colors ${
              showQueue
                ? "text-light-primary dark:text-sky-400 bg-light-primary/10 dark:bg-sky-500/10"
                : "text-light-primary dark:text-sky-400 hover:bg-light-primary/10 dark:hover:bg-sky-500/10"
            }`}
          >
            <span>Queue</span>
            {upcomingEpisodes.length > 0 && (
              <span className="opacity-70">({upcomingEpisodes.length})</span>
            )}
            {showQueue ? (
              <ChevronDown className="w-3 h-3" />
            ) : (
              <ChevronUp className="w-3 h-3" />
            )}
          </button>

          {/* Playback controls */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => skipBackward(10)}
              className="p-2 text-gray-500 dark:text-zinc-400 hover:text-light-primary dark:hover:text-sky-400 transition-colors relative"
              title="Back 10 seconds"
            >
              <RotateCcw className="w-8 h-8" />
              <span className="absolute inset-0 flex items-center justify-center text-[11px] font-bold mt-0.5">
                10
              </span>
            </button>

            <button
              onClick={togglePlayPause}
              className="p-3 bg-light-primary dark:bg-sky-600 rounded-full text-white hover:scale-105 hover:bg-light-primary/90 dark:hover:bg-sky-500 transition-all"
            >
              {isPlaying ? (
                <Pause className="w-6 h-6" />
              ) : (
                <Play className="w-6 h-6 ml-0.5" />
              )}
            </button>

            <button
              onClick={() => skipForward(30)}
              className="p-2 text-gray-500 dark:text-zinc-400 hover:text-light-primary dark:hover:text-sky-400 transition-colors relative"
              title="Forward 30 seconds"
            >
              <RotateCw className="w-8 h-8" />
              <span className="absolute inset-0 flex items-center justify-center text-[11px] font-bold mt-0.5">
                30
              </span>
            </button>
          </div>
        </div>

        {/* Right side - time, transcript, and volume */}
        <div className="flex items-center gap-4 flex-1 justify-end">
          {/* Time */}
          <div className="text-xs text-gray-500 dark:text-zinc-400">
            {formatDuration(Math.floor(currentTime))} / {formatDuration(duration)}
          </div>

          {/* Playback Speed */}
          <div ref={speedMenuRef} className="relative">
            <button
              onClick={() => setShowSpeedMenu(!showSpeedMenu)}
              className="px-2 py-1 text-xs font-medium text-gray-500 dark:text-zinc-400 hover:text-light-text dark:hover:text-white hover:bg-gray-200 dark:hover:bg-zinc-800 rounded transition-colors"
            >
              {playbackSpeed}x
            </button>
            {showSpeedMenu && (
              <div className="absolute bottom-full right-0 mb-2 bg-light-surface dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded-lg shadow-lg overflow-hidden">
                {speedOptions.map((speed) => (
                  <button
                    key={speed}
                    onClick={() => {
                      setPlaybackSpeed(speed);
                      setShowSpeedMenu(false);
                    }}
                    className={`block w-full px-4 py-2 text-sm text-left transition-colors ${
                      playbackSpeed === speed
                        ? "bg-light-primary/10 dark:bg-sky-500/20 text-light-primary dark:text-sky-400"
                        : "text-gray-600 dark:text-zinc-300 hover:bg-gray-100 dark:hover:bg-zinc-700"
                    }`}
                  >
                    {speed}x
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Transcript button */}
          {hasTranscript && (
            <button
              onClick={() => setShowTranscript(!showTranscript)}
              className={`p-1 transition-colors ${
                showTranscript ? "text-light-primary dark:text-sky-400" : "text-gray-500 dark:text-zinc-400 hover:text-light-text dark:hover:text-white"
              }`}
              title="Show transcript"
            >
              <FileText className="w-5 h-5" />
            </button>
          )}

          {/* Volume controls */}
          <div className="flex items-center gap-2">
            <button
              onClick={toggleMute}
              className="p-1 text-gray-500 dark:text-zinc-400 hover:text-light-text dark:hover:text-white transition-colors"
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
              className="w-20 h-1 bg-gray-300 dark:bg-zinc-700 rounded-lg appearance-none cursor-pointer accent-light-primary dark:accent-sky-500
                [&::-webkit-slider-thumb]:appearance-none
                [&::-webkit-slider-thumb]:w-3
                [&::-webkit-slider-thumb]:h-3
                [&::-webkit-slider-thumb]:rounded-full
                [&::-webkit-slider-thumb]:bg-light-primary
                dark:[&::-webkit-slider-thumb]:bg-sky-500
                [&::-webkit-slider-thumb]:cursor-pointer
                [&::-webkit-slider-thumb]:hover:bg-light-primary/80
                dark:[&::-webkit-slider-thumb]:hover:bg-sky-400
                [&::-moz-range-thumb]:w-3
                [&::-moz-range-thumb]:h-3
                [&::-moz-range-thumb]:rounded-full
                [&::-moz-range-thumb]:bg-light-primary
                dark:[&::-moz-range-thumb]:bg-sky-500
                [&::-moz-range-thumb]:border-0
                [&::-moz-range-thumb]:cursor-pointer"
              title={`Volume: ${Math.round(effectiveVolume * 100)}%`}
            />
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <>
      {renderMobileExpanded()}
      {renderDesktop()}
    </>
  );
}
