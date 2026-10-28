"use client";

import { createContext, useContext, useState, useRef, useEffect, useSyncExternalStore, ReactNode } from "react";
import { useSubscriptions } from "./subscription-context";
import { logPlayback } from "./playback-log";
import { NativeAudio, hasNativeAudio, type AudioLike } from "./native-audio";

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
// How often (in seconds of playback) to save the listening position
const PROGRESS_SAVE_INTERVAL = 5;

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

  // HTML5 audio in a browser; the native player in the Android app
  const audioRef = useRef<AudioLike | null>(null);
  const playNextRef = useRef<() => void>(() => {});

  // Listening position, saved to the subscription store (drives In Progress and resume)
  const { playbackProgress, updateProgress } = useSubscriptions();
  const playbackProgressRef = useRef(playbackProgress);
  const updateProgressRef = useRef(updateProgress);
  useEffect(() => {
    playbackProgressRef.current = playbackProgress;
    updateProgressRef.current = updateProgress;
  });
  // The episode whose position is being tracked; set synchronously when a new one loads
  const trackedEpisodeRef = useRef<Episode | null>(null);
  // True while a new episode loads and seeks to its saved spot, so its 0:00 start isn't saved over it
  const resumePendingRef = useRef(false);
  const lastSavedTimeRef = useRef(0);
  const saveProgressRef = useRef<(completed?: boolean) => void>(() => {});
  // Set whenever the app itself pauses or swaps the audio, so a pause we didn't ask
  // for (e.g. Chrome on Android pausing media when the screen turns off) can be told apart
  const intentionalPauseRef = useRef(false);
  // True only when the user paused (buttons or lock screen), so error recovery never restarts it
  const userPausedRef = useRef(false);
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

  useEffect(() => {
    const saveProgressFrom = (audio: AudioLike) => (completed = false) => {
      const episode = trackedEpisodeRef.current;
      if (!episode || resumePendingRef.current) return;
      const time = audio.currentTime;
      if (!completed && time < 1) return;
      lastSavedTimeRef.current = time;
      updateProgressRef.current(episode.id, time, completed);
    };

    // In the Android app the native player handles background playback, lock-screen controls
    // and stream recovery itself; this side tracks its state and saves progress.
    if (hasNativeAudio()) {
      const audio = new NativeAudio();
      audioRef.current = audio;
      const saveProgress = saveProgressFrom(audio);
      saveProgressRef.current = saveProgress;
      const info = () => ({
        t: Math.round(audio.currentTime),
        native: audio.nativeState,
        hidden: document.visibilityState === "hidden",
      });

      let lastHeartbeatAt = 0;
      audio.addEventListener("timeupdate", () => {
        // While in the background, note the position every 30s so the log shows playback continuing
        if (document.visibilityState === "hidden" && Date.now() - lastHeartbeatAt >= 30_000) {
          lastHeartbeatAt = Date.now();
          logPlayback("heartbeat", info());
        }
        setState((s) => ({ ...s, currentTime: audio.currentTime }));
        if (!audio.paused && Math.abs(audio.currentTime - lastSavedTimeRef.current) >= PROGRESS_SAVE_INTERVAL) {
          saveProgress();
        }
      });
      const onDuration = () => setState((s) => ({ ...s, duration: audio.duration || s.duration }));
      audio.addEventListener("loadedmetadata", onDuration);
      audio.addEventListener("durationchange", onDuration);
      audio.addEventListener("ended", () => {
        logPlayback("ended", info());
        saveProgress(true);
        playNextRef.current();
      });
      audio.addEventListener("play", () => {
        setState((s) => ({ ...s, isPlaying: true }));
        logPlayback("play", info());
      });
      audio.addEventListener("pause", () => {
        setState((s) => ({ ...s, isPlaying: false }));
        saveProgress();
        logPlayback("pause", info());
      });
      audio.addEventListener("error", () => {
        logPlayback("error", { code: audio.error?.code ?? null, message: audio.error?.message ?? null });
      });
      ["waiting", "playing"].forEach((type) => audio.addEventListener(type, () => logPlayback(type, info())));

      // Pick up an episode that kept playing while the page reloaded
      audio.sync().then(
        (native) => {
          if (trackedEpisodeRef.current || !native.episode || !native.url) return;
          try {
            const episode = JSON.parse(native.episode) as Episode;
            trackedEpisodeRef.current = episode;
            lastSavedTimeRef.current = native.position;
            setState((s) => ({
              ...s,
              currentEpisode: episode,
              currentTime: native.position,
              duration: native.duration > 0 ? native.duration : episode.duration || 0,
              isPlaying: native.playWhenReady && native.state !== "ended",
              playbackSpeed: native.speed,
            }));
            logPlayback("restore", info());
          } catch {
            // Not an episode we can show; leave the player empty
          }
        },
        (e: unknown) => logPlayback("native-unavailable", { error: e instanceof Error ? e.message : String(e) })
      );

      // Catch up (and save) when the app returns to the foreground
      const onVisibilityChange = () => {
        logPlayback("visibility", { state: document.visibilityState, playing: !audio.paused, ...info() });
        if (document.visibilityState === "visible") {
          audio.sync().then(() => saveProgress(), () => {});
        }
      };
      document.addEventListener("visibilitychange", onVisibilityChange);

      return () => {
        document.removeEventListener("visibilitychange", onVisibilityChange);
        audio.destroy();
      };
    }

    // Browser: an HTML5 audio element. It's attached to the page (hidden) rather than left
    // detached, so mobile browsers treat it as the page's primary media for background playback.
    const audio = new Audio();
    audioRef.current = audio;
    audio.preload = "auto";
    audio.setAttribute("playsinline", "");
    audio.style.display = "none";
    document.body.appendChild(audio);
    intentionalPauseRef.current = false;

    // Snapshot for the playback log. Chrome's decoded-byte counters show whether it is
    // treating the stream as video (videoBytes > 0), which Android pauses in the background.
    // Seconds of audio buffered past the playhead
    const bufferedAhead = () => {
      for (let i = 0; i < audio.buffered.length; i++) {
        if (audio.buffered.start(i) <= audio.currentTime && audio.currentTime <= audio.buffered.end(i)) {
          return audio.buffered.end(i) - audio.currentTime;
        }
      }
      return 0;
    };
    const mediaInfo = () => {
      const media = audio as HTMLAudioElement & {
        webkitAudioDecodedByteCount?: number;
        webkitVideoDecodedByteCount?: number;
      };
      return {
        t: Math.round(audio.currentTime),
        ahead: Math.round(bufferedAhead()),
        hidden: document.visibilityState === "hidden",
        ready: audio.readyState,
        network: audio.networkState,
        audioBytes: media.webkitAudioDecodedByteCount ?? null,
        videoBytes: media.webkitVideoDecodedByteCount ?? null,
      };
    };

    // If playback pauses while the page is hidden and we didn't pause it, resume once,
    // right away (timers don't run on a hidden page). A real interruption (e.g. a phone
    // call) refuses the resume, and we don't retry until the page has been visible again.
    let resumedWhileHidden = false;
    const onVisibilityChange = () => {
      logPlayback("visibility", { state: document.visibilityState, playing: !audio.paused, ...mediaInfo() });
      if (document.visibilityState === "visible") resumedWhileHidden = false;
    };
    document.addEventListener("visibilitychange", onVisibilityChange);
    // Page lifecycle: freeze/resume fire on document, pagehide/pageshow on window
    const onLifecycle = (e: Event) => logPlayback(`page-${e.type}`, { playing: !audio.paused });
    ["freeze", "resume"].forEach((type) => document.addEventListener(type, onLifecycle));
    ["pagehide", "pageshow"].forEach((type) => window.addEventListener(type, onLifecycle));

    const resumeIfUnexpected = () => {
      const intentional = intentionalPauseRef.current;
      intentionalPauseRef.current = false;
      logPlayback("pause", { ...mediaInfo(), intentional, ended: audio.ended });
      if (intentional || audio.ended || !audio.src) return;
      if (document.visibilityState !== "hidden" || resumedWhileHidden) return;
      resumedWhileHidden = true;
      logPlayback("resume-attempt");
      audio.play().then(
        () => logPlayback("resume-ok", mediaInfo()),
        (e: unknown) => logPlayback("resume-refused", { error: e instanceof Error ? `${e.name}: ${e.message}` : String(e) })
      );
    };

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

    const saveProgress = saveProgressFrom(audio);
    saveProgressRef.current = saveProgress;

    // Reload the current episode's audio and resume at the last good position. This is what
    // a page reload did on a Pixel when the stream errored out or wedged; pause + play alone
    // doesn't recover those. Capped at 3 reloads per 5 minutes so a dead link can't loop.
    let lastGoodTime = 0;
    let reloadTimes: number[] = [];
    const reloadAtPosition = (reason: string) => {
      const episode = trackedEpisodeRef.current;
      if (!episode || userPausedRef.current) return;
      const now = Date.now();
      reloadTimes = reloadTimes.filter((t) => now - t < 5 * 60_000);
      if (reloadTimes.length >= 3) {
        logPlayback("reload-giveup", { reason });
        return;
      }
      reloadTimes.push(now);
      const resumeAt = Math.max(lastGoodTime, audio.currentTime || 0);
      logPlayback("reload", { reason, resumeAt: Math.round(resumeAt), attempt: reloadTimes.length });

      resumePendingRef.current = true;
      if (!audio.paused) intentionalPauseRef.current = true;
      audio.addEventListener(
        "loadedmetadata",
        () => {
          if (resumeAt > 0 && resumeAt < (audio.duration || Infinity) - 1) audio.currentTime = resumeAt;
          resumePendingRef.current = false;
          intentionalPauseRef.current = false;
          audio.play().then(
            () => logPlayback("reload-ok", mediaInfo()),
            (e: unknown) => logPlayback("reload-refused", { error: e instanceof Error ? `${e.name}: ${e.message}` : String(e) })
          );
        },
        { once: true }
      );
      audio.src = episode.audioUrl;
      audio.load();
    };

    // Watchdog for stuck playback. In the background (where some Android phones go silent
    // while still reporting "playing") it first tries a pause + play, like the media card's
    // buttons. If the position still hasn't moved 6s later, or a visible player is "playing"
    // with audio buffered but frozen for 8s, the pipeline is wedged: reload at this spot.
    let lastPosition = -1;
    let lastAdvanceAt = Date.now();
    let kickedAt = 0;
    const watchdog = setInterval(() => {
      const now = Date.now();
      if (audio.currentTime !== lastPosition || audio.paused || resumePendingRef.current) {
        lastPosition = audio.currentTime;
        lastAdvanceAt = now;
        kickedAt = 0;
        return;
      }
      const stuckFor = now - lastAdvanceAt;
      const hidden = document.visibilityState === "hidden";
      const kickFailed = kickedAt > 0 && now - kickedAt >= 6000;
      const wedgedVisible = !hidden && stuckFor >= 8000 && audio.readyState >= 3 && bufferedAhead() >= 5;
      if (kickFailed || wedgedVisible) {
        kickedAt = 0;
        lastAdvanceAt = now;
        reloadAtPosition(kickFailed ? "stuck-after-kick" : "stuck");
        return;
      }
      if (!hidden || stuckFor < 4000 || kickedAt > 0) return;
      kickedAt = now;
      logPlayback("stall-kick", { ...mediaInfo(), stuckSec: Math.round(stuckFor / 1000) });
      intentionalPauseRef.current = true;
      audio.pause();
      audio.play().then(
        () => logPlayback("stall-kick-ok", mediaInfo()),
        (e: unknown) => logPlayback("stall-kick-refused", { error: e instanceof Error ? `${e.name}: ${e.message}` : String(e) })
      );
    }, 2000);

    let lastHeartbeatAt = 0;
    audio.addEventListener("timeupdate", () => {
      // While the screen is off, note the position every 5s so gaps show stalls or freezes
      if (document.visibilityState === "hidden" && Date.now() - lastHeartbeatAt >= 5000) {
        lastHeartbeatAt = Date.now();
        logPlayback("heartbeat", mediaInfo());
      }
      setState((s) => ({ ...s, currentTime: audio.currentTime }));
      if (!resumePendingRef.current && audio.currentTime > 0) lastGoodTime = audio.currentTime;
      if (!audio.paused && Math.abs(audio.currentTime - lastSavedTimeRef.current) >= PROGRESS_SAVE_INTERVAL) {
        saveProgress();
      }
    });

    audio.addEventListener("loadedmetadata", () => {
      setState((s) => ({ ...s, duration: audio.duration || s.duration }));
    });

    audio.addEventListener("durationchange", () => {
      setState((s) => ({ ...s, duration: audio.duration || s.duration }));
    });

    audio.addEventListener("ended", () => {
      saveProgress(true);
      // Auto-play next episode in queue
      playNextRef.current();
    });

    audio.addEventListener("play", () => {
      userPausedRef.current = false;
      setState((s) => ({ ...s, isPlaying: true }));
      logPlayback("play", mediaInfo());
    });

    audio.addEventListener("pause", () => {
      setState((s) => ({ ...s, isPlaying: false }));
      saveProgress();
      resumeIfUnexpected();
    });

    audio.addEventListener("error", (e) => {
      console.error("Audio playback error:", e);
      // Clearing src on teardown raises an "Empty src" error; that one isn't a playback problem
      if (audio.error && !audio.error.message.includes("Empty src")) {
        logPlayback("error", { code: audio.error.code, message: audio.error.message });
        // Network (2) or decode (3) failure mid-episode: reload and resume, backing off
        const code = audio.error.code;
        if ((code === 2 || code === 3) && trackedEpisodeRef.current) {
          setTimeout(() => reloadAtPosition(`error-${code}`), 1000 + reloadTimes.length * 2000);
        }
      }
    });
    ["stalled", "waiting", "playing"].forEach((type) =>
      audio.addEventListener(type, () => logPlayback(type, mediaInfo()))
    );
    // Downloading in the background: log at most one "progress" per 5s while hidden
    let lastProgressLogAt = 0;
    audio.addEventListener("progress", () => {
      if (document.visibilityState === "hidden" && Date.now() - lastProgressLogAt >= 5000) {
        lastProgressLogAt = Date.now();
        logPlayback("download", mediaInfo());
      }
    });

    return () => {
      clearInterval(watchdog);
      document.removeEventListener("visibilitychange", onVisibilityChange);
      ["freeze", "resume"].forEach((type) => document.removeEventListener(type, onLifecycle));
      ["pagehide", "pageshow"].forEach((type) => window.removeEventListener(type, onLifecycle));
      intentionalPauseRef.current = true;
      audio.pause();
      audio.src = "";
      audio.remove();
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

  // Lock-screen / notification controls (Media Session API). The Android app's native player
  // has its own.
  useEffect(() => {
    if (!("mediaSession" in navigator) || hasNativeAudio()) return;
    const session = navigator.mediaSession;
    const audio = () => audioRef.current;

    const handlers: [MediaSessionAction, MediaSessionActionHandler][] = [
      ["play", () => { audio()?.play().catch((e) => console.error("Failed to play:", e)); }],
      ["pause", () => { intentionalPauseRef.current = true; userPausedRef.current = true; audio()?.pause(); }],
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
    if (!("mediaSession" in navigator) || hasNativeAudio()) return;
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
    if (!("mediaSession" in navigator) || hasNativeAudio()) return;
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

  // Loads an episode into the audio element, saving the outgoing episode's position first
  // and resuming the new one where it was left off. Returns the resume time.
  const loadEpisode = (audio: AudioLike, episode: Episode) => {
    saveProgressRef.current();

    const saved = playbackProgressRef.current.find(
      (p) => p.episodeId === episode.id && !p.completed && p.currentTime > 0
    );
    const resumeAt = saved?.currentTime ?? 0;

    trackedEpisodeRef.current = episode;
    resumePendingRef.current = true;
    if (!audio.paused) intentionalPauseRef.current = true;
    lastSavedTimeRef.current = resumeAt;

    if (audio instanceof NativeAudio) {
      // The native player starts at the saved spot itself
      audio.setTrack({
        id: episode.id,
        title: episode.title,
        artist: episode.podcastTitle,
        artworkUrl: episode.podcastArtworkUrl,
        startAt: resumeAt,
        json: JSON.stringify(episode),
      });
      resumePendingRef.current = false;
    } else {
      const finishResume = () => {
        if (resumeAt > 0 && resumeAt < (audio.duration || Infinity) - 5) {
          audio.currentTime = resumeAt;
        }
        resumePendingRef.current = false;
      };
      audio.addEventListener("loadedmetadata", finishResume, { once: true });
      audio.addEventListener("error", () => { resumePendingRef.current = false; }, { once: true });
    }

    try {
      const url = new URL(episode.audioUrl);
      logPlayback("load", { host: url.hostname, file: url.pathname.split(".").pop()?.slice(0, 5) ?? "", resumeAt: Math.round(resumeAt) });
    } catch {
      logPlayback("load", { resumeAt: Math.round(resumeAt) });
    }
    audio.src = episode.audioUrl;
    audio.load();
    return resumeAt;
  };

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
    const resumeAt = loadEpisode(audio, episode);
    setState((s) => ({
      ...s,
      currentEpisode: episode,
      currentTime: resumeAt,
      duration: episode.duration || 0,
    }));

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
      intentionalPauseRef.current = true;
      userPausedRef.current = true;
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
      intentionalPauseRef.current = true;
      userPausedRef.current = true;
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

    const resumeAt = loadEpisode(audio, firstEpisode);
    setState((s) => ({
      ...s,
      queue: episodes,
      queueIndex: 0,
      currentEpisode: firstEpisode,
      currentTime: resumeAt,
      duration: firstEpisode.duration || 0,
    }));

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

    const resumeAt = loadEpisode(audio, nextEpisode);
    setState((s) => ({
      ...s,
      queueIndex: nextIndex,
      currentEpisode: nextEpisode,
      currentTime: resumeAt,
      duration: nextEpisode.duration || 0,
    }));

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

    const resumeAt = loadEpisode(audio, prevEpisode);
    setState((s) => ({
      ...s,
      queueIndex: prevIndex,
      currentEpisode: prevEpisode,
      currentTime: resumeAt,
      duration: prevEpisode.duration || 0,
    }));

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
