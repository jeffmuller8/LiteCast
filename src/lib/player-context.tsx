"use client";

import { createContext, useContext, useState, useRef, useEffect, useSyncExternalStore, ReactNode } from "react";

interface Episode {
  id: string;
  podcastId?: string;
  title: string;
  description: string;
  audioUrl: string;
  duration: number;
  publishedAt: string;
  podcastTitle: string;
  podcastArtworkUrl: string;
  transcriptUrl?: string;
}

interface PlayerState {
  currentEpisode: Episode | null;
  queue: Episode[];
  queueIndex: number;
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  playbackSpeed: number;
  volume: number;
  isMuted: boolean;
}

interface PlayerContextType extends PlayerState {
  play: (episode: Episode) => void;
  playAll: (episodes: Episode[]) => void;
  addToQueue: (episode: Episode) => void;
  reorderQueue: (fromIndex: number, toIndex: number) => void;
  removeFromQueue: (index: number) => void;
  playNext: () => void;
  playPrevious: () => void;
  togglePlayPause: () => void;
  pause: () => void;
  seekTo: (time: number) => void;
  skipForward: (seconds?: number) => void;
  skipBackward: (seconds?: number) => void;
  setPlaybackSpeed: (speed: number) => void;
  setVolume: (volume: number) => void;
  toggleMute: () => void;
  hasNext: boolean;
  hasPrevious: boolean;
  queueCount: number;
  keepScreenOn: boolean;
  setKeepScreenOn: (on: boolean) => void;
  wakeLockSupported: boolean;
}

const KEEP_SCREEN_ON_KEY = "litecast-keep-screen-on";

// The keep-screen-on preference lives in localStorage; components re-read it via
// useSyncExternalStore so server and client renders agree (false on the server).
const keepScreenOnListeners = new Set<() => void>();
function subscribeKeepScreenOn(onChange: () => void) {
  keepScreenOnListeners.add(onChange);
  return () => {
    keepScreenOnListeners.delete(onChange);
  };
}
function readKeepScreenOn() {
  try {
    return localStorage.getItem(KEEP_SCREEN_ON_KEY) === "true";
  } catch {
    return false; // Storage unavailable (private mode)
  }
}
const noSubscribe = () => () => {};
const SKIP_BACK_SECONDS = 10;
const SKIP_FORWARD_SECONDS = 30;

const PlayerContext = createContext<PlayerContextType | null>(null);

export function PlayerProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<PlayerState>({
    currentEpisode: null,
    queue: [],
    queueIndex: -1,
    isPlaying: false,
    currentTime: 0,
    duration: 0,
    playbackSpeed: 1,
    volume: 1,
    isMuted: false,
  });

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const playNextRef = useRef<() => void>(() => {});
  const keepScreenOn = useSyncExternalStore(subscribeKeepScreenOn, readKeepScreenOn, () => false);
  const wakeLockSupported = useSyncExternalStore(noSubscribe, () => "wakeLock" in navigator, () => false);

  const setKeepScreenOn = (on: boolean) => {
    try {
      localStorage.setItem(KEEP_SCREEN_ON_KEY, String(on));
    } catch {
      // Storage unavailable; nothing to persist
    }
    keepScreenOnListeners.forEach((notify) => notify());
  };

  // Initialize audio element
  useEffect(() => {
    audioRef.current = new Audio();
    const audio = audioRef.current;

    // Keeps the lock-screen scrubber in step; the OS extrapolates between updates
    const updatePositionState = () => {
      if (!("mediaSession" in navigator) || !Number.isFinite(audio.duration) || audio.duration <= 0) return;
      try {
        navigator.mediaSession.setPositionState({
          duration: audio.duration,
          position: Math.min(audio.currentTime, audio.duration),
          playbackRate: audio.playbackRate,
        });
      } catch {
        // Some browsers reject position updates mid-load
      }
    };
    ["loadedmetadata", "durationchange", "seeked", "ratechange", "play", "pause"].forEach((type) =>
      audio.addEventListener(type, updatePositionState)
    );

    audio.addEventListener("timeupdate", () => {
      setState((s) => ({ ...s, currentTime: audio.currentTime }));
    });

    audio.addEventListener("loadedmetadata", () => {
      setState((s) => ({ ...s, duration: audio.duration || s.duration }));
    });

    audio.addEventListener("durationchange", () => {
      setState((s) => ({ ...s, duration: audio.duration || s.duration }));
    });

    audio.addEventListener("ended", () => {
      // Auto-play next episode in queue
      playNextRef.current();
    });

    audio.addEventListener("play", () => {
      setState((s) => ({ ...s, isPlaying: true }));
    });

    audio.addEventListener("pause", () => {
      setState((s) => ({ ...s, isPlaying: false }));
    });

    audio.addEventListener("error", (e) => {
      console.error("Audio playback error:", e);
    });

    return () => {
      audio.pause();
      audio.src = "";
    };
  }, []);

  // Sync volume and mute state with audio element
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = state.isMuted ? 0 : state.volume;
    }
  }, [state.volume, state.isMuted]);

  // Sync playback speed with audio element
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.playbackRate = state.playbackSpeed;
    }
  }, [state.playbackSpeed]);

  // Lock-screen / notification controls (Media Session API)
  useEffect(() => {
    if (!("mediaSession" in navigator)) return;
    const session = navigator.mediaSession;
    const audio = () => audioRef.current;

    const handlers: [MediaSessionAction, MediaSessionActionHandler][] = [
      ["play", () => { audio()?.play().catch((e) => console.error("Failed to play:", e)); }],
      ["pause", () => audio()?.pause()],
      ["seekbackward", (details) => {
        const a = audio();
        if (a) a.currentTime = Math.max(a.currentTime - (details.seekOffset || SKIP_BACK_SECONDS), 0);
      }],
      ["seekforward", (details) => {
        const a = audio();
        if (a) a.currentTime = Math.min(a.currentTime + (details.seekOffset || SKIP_FORWARD_SECONDS), a.duration || Infinity);
      }],
      ["seekto", (details) => {
        const a = audio();
        if (a && details.seekTime != null) a.currentTime = details.seekTime;
      }],
    ];

    for (const [action, handler] of handlers) {
      try {
        session.setActionHandler(action, handler);
      } catch {
        // Action not supported by this browser
      }
    }

    return () => {
      for (const [action] of handlers) {
        try {
          session.setActionHandler(action, null);
        } catch {
          // Ignore
        }
      }
    };
  }, []);

  // Show the current episode's title, show and artwork on the lock screen
  useEffect(() => {
    if (!("mediaSession" in navigator)) return;
    const episode = state.currentEpisode;
    navigator.mediaSession.metadata = episode
      ? new MediaMetadata({
          title: episode.title,
          artist: episode.podcastTitle,
          album: "LiteCast",
          artwork: episode.podcastArtworkUrl
            ? [{ src: episode.podcastArtworkUrl, sizes: "512x512" }]
            : [],
        })
      : null;
  }, [state.currentEpisode]);

  useEffect(() => {
    if (!("mediaSession" in navigator)) return;
    navigator.mediaSession.playbackState = state.currentEpisode
      ? state.isPlaying ? "playing" : "paused"
      : "none";
  }, [state.isPlaying, state.currentEpisode]);

  // Keep the screen awake while playing, if the user turned that on (Screen Wake Lock API).
  // The browser drops the lock whenever the page is hidden, so re-request when it comes back.
  useEffect(() => {
    if (!keepScreenOn || !state.isPlaying || !("wakeLock" in navigator)) return;

    let lock: WakeLockSentinel | null = null;
    let cancelled = false;

    const acquire = async () => {
      if (document.visibilityState !== "visible" || (lock && !lock.released)) return;
      try {
        const sentinel = await navigator.wakeLock.request("screen");
        if (cancelled) {
          sentinel.release();
        } else {
          lock = sentinel;
        }
      } catch (e) {
        console.warn("Screen wake lock unavailable:", e);
      }
    };

    acquire();
    document.addEventListener("visibilitychange", acquire);

    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", acquire);
      lock?.release().catch(() => {});
    };
  }, [keepScreenOn, state.isPlaying]);

  const play = async (episode: Episode) => {
    if (!audioRef.current) return;

    const audio = audioRef.current;

    // If same episode, just resume
    if (state.currentEpisode?.id === episode.id) {
      try {
        await audio.play();
      } catch (e) {
        console.error("Failed to play:", e);
      }
      return;
    }

    // Load new episode
    setState((s) => ({
      ...s,
      currentEpisode: episode,
      currentTime: 0,
      duration: episode.duration || 0,
    }));

    audio.src = episode.audioUrl;
    audio.load();

    try {
      await audio.play();
    } catch (e) {
      console.error("Failed to play:", e);
    }
  };

  const togglePlayPause = async () => {
    if (!audioRef.current || !state.currentEpisode) return;

    const audio = audioRef.current;

    if (state.isPlaying) {
      audio.pause();
    } else {
      try {
        await audio.play();
      } catch (e) {
        console.error("Failed to play:", e);
      }
    }
  };

  const pause = () => {
    if (audioRef.current) {
      audioRef.current.pause();
    }
  };

  const seekTo = (time: number) => {
    if (audioRef.current) {
      audioRef.current.currentTime = time;
      setState((s) => ({ ...s, currentTime: time }));
    }
  };

  const skipForward = (seconds = 30) => {
    if (audioRef.current) {
      const newTime = Math.min(audioRef.current.currentTime + seconds, audioRef.current.duration || Infinity);
      audioRef.current.currentTime = newTime;
    }
  };

  const skipBackward = (seconds = 10) => {
    if (audioRef.current) {
      const newTime = Math.max(audioRef.current.currentTime - seconds, 0);
      audioRef.current.currentTime = newTime;
    }
  };

  const setPlaybackSpeed = (speed: number) => {
    setState((s) => ({ ...s, playbackSpeed: speed }));
  };

  const setVolume = (volume: number) => {
    setState((s) => ({ ...s, volume, isMuted: volume === 0 }));
  };

  const toggleMute = () => {
    setState((s) => ({ ...s, isMuted: !s.isMuted }));
  };

  const playAll = async (episodes: Episode[]) => {
    if (!audioRef.current || episodes.length === 0) return;

    const audio = audioRef.current;
    const firstEpisode = episodes[0];

    setState((s) => ({
      ...s,
      queue: episodes,
      queueIndex: 0,
      currentEpisode: firstEpisode,
      currentTime: 0,
      duration: firstEpisode.duration || 0,
    }));

    audio.src = firstEpisode.audioUrl;
    audio.load();

    try {
      await audio.play();
    } catch (e) {
      console.error("Failed to play:", e);
    }
  };

  const playNext = async () => {
    if (!audioRef.current) return;

    const nextIndex = state.queueIndex + 1;
    if (nextIndex >= state.queue.length) {
      setState((s) => ({ ...s, isPlaying: false }));
      return;
    }

    const nextEpisode = state.queue[nextIndex];
    const audio = audioRef.current;

    setState((s) => ({
      ...s,
      queueIndex: nextIndex,
      currentEpisode: nextEpisode,
      currentTime: 0,
      duration: nextEpisode.duration || 0,
    }));

    audio.src = nextEpisode.audioUrl;
    audio.load();

    try {
      await audio.play();
    } catch (e) {
      console.error("Failed to play next:", e);
    }
  };

  const playPrevious = async () => {
    if (!audioRef.current) return;

    const prevIndex = state.queueIndex - 1;
    if (prevIndex < 0) return;

    const prevEpisode = state.queue[prevIndex];
    const audio = audioRef.current;

    setState((s) => ({
      ...s,
      queueIndex: prevIndex,
      currentEpisode: prevEpisode,
      currentTime: 0,
      duration: prevEpisode.duration || 0,
    }));

    audio.src = prevEpisode.audioUrl;
    audio.load();

    try {
      await audio.play();
    } catch (e) {
      console.error("Failed to play previous:", e);
    }
  };

  const addToQueue = (episode: Episode) => {
    setState((s) => ({
      ...s,
      queue: [...s.queue, episode],
    }));
  };

  const reorderQueue = (fromIndex: number, toIndex: number) => {
    setState((s) => {
      // Convert to actual queue indices (accounting for queueIndex offset)
      const actualFromIndex = s.queueIndex + 1 + fromIndex;
      const actualToIndex = s.queueIndex + 1 + toIndex;

      const newQueue = [...s.queue];
      const [removed] = newQueue.splice(actualFromIndex, 1);
      newQueue.splice(actualToIndex, 0, removed);

      return { ...s, queue: newQueue };
    });
  };

  const removeFromQueue = (index: number) => {
    setState((s) => {
      const actualIndex = s.queueIndex + 1 + index;
      const newQueue = s.queue.filter((_, i) => i !== actualIndex);
      return { ...s, queue: newQueue };
    });
  };

  // Update the ref so the ended event handler can call playNext
  playNextRef.current = playNext;

  const hasNext = state.queueIndex < state.queue.length - 1;
  const hasPrevious = state.queueIndex > 0;
  const queueCount = state.queue.length > 0 ? state.queue.length - state.queueIndex - 1 : 0;

  return (
    <PlayerContext.Provider
      value={{
        ...state,
        play,
        playAll,
        addToQueue,
        reorderQueue,
        removeFromQueue,
        playNext,
        playPrevious,
        togglePlayPause,
        pause,
        seekTo,
        skipForward,
        skipBackward,
        setPlaybackSpeed,
        setVolume,
        toggleMute,
        hasNext,
        hasPrevious,
        queueCount,
        keepScreenOn,
        setKeepScreenOn,
        wakeLockSupported,
      }}
    >
      {children}
    </PlayerContext.Provider>
  );
}

export function usePlayer() {
  const context = useContext(PlayerContext);
  if (!context) {
    throw new Error("usePlayer must be used within a PlayerProvider");
  }
  return context;
}
