"use client";

import { createContext, useContext, useState, useRef, useEffect, ReactNode } from "react";

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
}

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

  // Initialize audio element
  useEffect(() => {
    audioRef.current = new Audio();
    const audio = audioRef.current;

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
