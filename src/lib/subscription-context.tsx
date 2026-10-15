"use client";

import { createContext, useContext, useState, useEffect, ReactNode, useCallback, useRef } from "react";
import { doc, setDoc, getDoc, onSnapshot } from "firebase/firestore";
import { db } from "./firebase";
import { useAuth } from "./auth-context";

export interface Podcast {
  id: string;
  title: string;
  author: string;
  description: string;
  artworkUrl: string;
  feedUrl: string;
}

export interface Episode {
  id: string;
  podcastId: string;
  title: string;
  description: string;
  audioUrl: string;
  duration: number;
  publishedAt: string;
  podcastTitle: string;
  podcastArtworkUrl: string;
  transcriptUrl?: string;
}

export interface PlaybackProgress {
  episodeId: string;
  currentTime: number;
  completed: boolean;
}

export interface ListeningStats {
  podcastId: string;
  playCount: number;
  totalTimeListened: number; // in seconds
  lastPlayedAt: string;
}

interface UserData {
  podcasts: Podcast[];
  episodes: Episode[];
  playbackProgress: PlaybackProgress[];
  bookmarkedEpisodeIds: string[];
  pinnedPodcastIds: string[];
  listeningStats: ListeningStats[];
}

interface SubscriptionContextType {
  podcasts: Podcast[];
  episodes: Episode[];
  playbackProgress: PlaybackProgress[];
  bookmarkedEpisodeIds: string[];
  pinnedPodcastIds: string[];
  listeningStats: ListeningStats[];
  isHydrated: boolean;
  subscribe: (podcast: Podcast, feedUrl: string) => Promise<void>;
  unsubscribe: (podcastId: string) => void;
  isSubscribed: (podcastId: string) => boolean;
  getNewReleases: (sortBy?: NewReleasesSortOption) => Episode[];
  getInProgressEpisodes: () => (Episode & { progress: number })[];
  getBookmarkedEpisodes: () => Episode[];
  updateProgress: (episodeId: string, currentTime: number, completed: boolean) => void;
  toggleBookmark: (episodeId: string) => void;
  isBookmarked: (episodeId: string) => boolean;
  fetchAllEpisodes: (podcastId: string) => Promise<{ added: number; total: number }>;
  togglePin: (podcastId: string) => void;
  isPinned: (podcastId: string) => boolean;
  recordPlay: (podcastId: string, duration: number) => void;
  getListeningStats: (podcastId: string) => ListeningStats | undefined;
}

export type NewReleasesSortOption = "newest" | "pinned" | "most-listened" | "oldest" | "a-z";

const SubscriptionContext = createContext<SubscriptionContextType | null>(null);

// An episode as returned by /api/feed/episodes
interface FeedEpisode {
  id?: string;
  title: string;
  description?: string;
  audioUrl?: string;
  duration?: number;
  publishedAt?: string;
  transcriptUrl?: string;
}

// Maps an episode from /api/feed/episodes onto our Episode shape
function toEpisode(ep: FeedEpisode, podcast: Podcast): Episode {
  return {
    id: ep.id || `${podcast.id}-${ep.title}`,
    podcastId: podcast.id,
    title: ep.title,
    description: ep.description || "",
    audioUrl: ep.audioUrl || "",
    duration: ep.duration || 0,
    publishedAt: ep.publishedAt || new Date().toISOString(),
    podcastTitle: podcast.title,
    podcastArtworkUrl: podcast.artworkUrl,
    transcriptUrl: ep.transcriptUrl,
  };
}

// How many feeds to refresh at once on load
const FEED_REFRESH_CONCURRENCY = 4;

export function SubscriptionProvider({ children }: { children: ReactNode }) {
  const { user, loading: authLoading } = useAuth();
  const [podcasts, setPodcasts] = useState<Podcast[]>([]);
  const [episodes, setEpisodes] = useState<Episode[]>([]);
  const [playbackProgress, setPlaybackProgress] = useState<PlaybackProgress[]>([]);
  const [bookmarkedEpisodeIds, setBookmarkedEpisodeIds] = useState<string[]>([]);
  const [pinnedPodcastIds, setPinnedPodcastIds] = useState<string[]>([]);
  const [listeningStats, setListeningStats] = useState<ListeningStats[]>([]);
  const [isHydrated, setIsHydrated] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const isSyncingRef = useRef(false);
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const firestoreErrorCount = useRef(0);
  const refreshedForUserRef = useRef<string | null>(null);

  // Save to Firestore when user is logged in
  const saveToFirestore = useCallback(async (data: UserData) => {
    if (!user || isSyncing || !db) return;

    // Stop trying after too many errors (e.g., document too large)
    if (firestoreErrorCount.current >= 5) {
      console.warn("Firestore saves disabled due to repeated errors. Using localStorage only.");
      return;
    }

    try {
      // Aggressively reduce episode data for Firestore (1MB limit)
      // Only keep essential fields, remove descriptions entirely for cloud storage
      const minimalEpisodes = data.episodes.map(ep => ({
        id: ep.id,
        podcastId: ep.podcastId,
        title: ep.title,
        description: "", // Don't store descriptions in Firestore - too large
        audioUrl: ep.audioUrl,
        duration: ep.duration,
        publishedAt: ep.publishedAt,
        podcastTitle: ep.podcastTitle,
        podcastArtworkUrl: ep.podcastArtworkUrl,
        // Omit transcriptUrl to save space
      }));

      // Limit to most recent 100 episodes per podcast to avoid size issues
      const podcastEpisodeCounts = new Map<string, number>();
      const limitedEpisodes = minimalEpisodes.filter(ep => {
        const count = podcastEpisodeCounts.get(ep.podcastId) || 0;
        if (count < 100) {
          podcastEpisodeCounts.set(ep.podcastId, count + 1);
          return true;
        }
        return false;
      });

      await setDoc(doc(db, "users", user.uid), {
        podcasts: data.podcasts,
        episodes: limitedEpisodes,
        playbackProgress: data.playbackProgress,
        bookmarkedEpisodeIds: data.bookmarkedEpisodeIds,
        pinnedPodcastIds: data.pinnedPodcastIds || [],
        listeningStats: data.listeningStats || [],
        updatedAt: new Date().toISOString(),
      });

      // Reset error count on success
      firestoreErrorCount.current = 0;
      console.log(`Firestore save successful: ${data.podcasts.length} podcasts, ${limitedEpisodes.length} episodes`);
    } catch (error: any) {
      console.error("Error saving to Firestore:", error?.message || error);
      firestoreErrorCount.current++;

      // If it's a size error, try saving just podcasts without episodes
      if (error?.message?.includes("size") || firestoreErrorCount.current >= 3) {
        try {
          await setDoc(doc(db, "users", user.uid), {
            podcasts: data.podcasts,
            episodes: [], // Skip episodes if document too large
            playbackProgress: data.playbackProgress,
            bookmarkedEpisodeIds: data.bookmarkedEpisodeIds,
            pinnedPodcastIds: data.pinnedPodcastIds || [],
            listeningStats: data.listeningStats || [],
            updatedAt: new Date().toISOString(),
            note: "Episodes stored locally only due to size limits",
          });
          console.log("Firestore fallback save (podcasts only) successful");
        } catch (fallbackError) {
          console.error("Firestore fallback save also failed:", fallbackError);
        }
      }
    }
  }, [user, isSyncing]);

  // Load data from Firestore or localStorage
  useEffect(() => {
    // Don't load until auth has finished initializing
    if (authLoading) return;

    const loadData = async () => {
      if (user && db) {
        // User is logged in - load from Firestore and merge with localStorage
        setIsSyncing(true);
        isSyncingRef.current = true;
        try {
          const docRef = doc(db, "users", user.uid);
          const docSnap = await getDoc(docRef);

          // Always check localStorage for potentially newer data
          const savedPodcasts = localStorage.getItem("litecast-podcasts");
          const savedEpisodes = localStorage.getItem("litecast-episodes");
          const savedProgress = localStorage.getItem("litecast-progress");
          const savedBookmarks = localStorage.getItem("litecast-bookmarks");
          const savedPinned = localStorage.getItem("litecast-pinned");
          const savedStats = localStorage.getItem("litecast-listening-stats");

          const localData: UserData = {
            podcasts: savedPodcasts ? JSON.parse(savedPodcasts) : [],
            episodes: savedEpisodes ? JSON.parse(savedEpisodes) : [],
            playbackProgress: savedProgress ? JSON.parse(savedProgress) : [],
            bookmarkedEpisodeIds: savedBookmarks ? JSON.parse(savedBookmarks) : [],
            pinnedPodcastIds: savedPinned ? JSON.parse(savedPinned) : [],
            listeningStats: savedStats ? JSON.parse(savedStats) : [],
          };

          if (docSnap.exists()) {
            const cloudData = docSnap.data() as UserData;

            // Merge strategy: combine podcasts from both sources, prefer local episodes
            // (localStorage has full episode data, Firestore has limited data due to size)
            const cloudPodcasts = cloudData.podcasts || [];
            const localPodcastIds = new Set(localData.podcasts.map(p => p.id));
            const cloudOnlyPodcasts = cloudPodcasts.filter(p => !localPodcastIds.has(p.id));

            // Merge podcasts (local + any cloud-only podcasts)
            const mergedPodcasts = [...localData.podcasts, ...cloudOnlyPodcasts];

            // For episodes: always prefer localStorage (has full descriptions)
            // Only use cloud episodes for podcasts we don't have locally
            const localEpisodePodcastIds = new Set(localData.episodes.map(e => e.podcastId));
            const cloudOnlyEpisodes = (cloudData.episodes || []).filter(
              e => !localEpisodePodcastIds.has(e.podcastId)
            );
            const mergedEpisodes = [...localData.episodes, ...cloudOnlyEpisodes];

            // Merge playback progress (union, prefer local for conflicts)
            const localProgressIds = new Set(localData.playbackProgress.map(p => p.episodeId));
            const cloudOnlyProgress = (cloudData.playbackProgress || []).filter(
              p => !localProgressIds.has(p.episodeId)
            );
            const mergedProgress = [...localData.playbackProgress, ...cloudOnlyProgress];

            // Merge bookmarks (union)
            const mergedBookmarks = [...new Set([
              ...localData.bookmarkedEpisodeIds,
              ...(cloudData.bookmarkedEpisodeIds || [])
            ])];

            // Merge pinned podcasts (union)
            const mergedPinned = [...new Set([
              ...localData.pinnedPodcastIds,
              ...(cloudData.pinnedPodcastIds || [])
            ])];

            // Merge listening stats (prefer local, add cloud-only)
            const localStatsIds = new Set(localData.listeningStats.map(s => s.podcastId));
            const cloudOnlyStats = (cloudData.listeningStats || []).filter(
              s => !localStatsIds.has(s.podcastId)
            );
            const mergedStats = [...localData.listeningStats, ...cloudOnlyStats];

            setPodcasts(mergedPodcasts);
            setEpisodes(mergedEpisodes);
            setPlaybackProgress(mergedProgress);
            setBookmarkedEpisodeIds(mergedBookmarks);
            setPinnedPodcastIds(mergedPinned);
            setListeningStats(mergedStats);

            console.log(`Loaded: ${mergedPodcasts.length} podcasts, ${mergedEpisodes.length} episodes`);
          } else {
            // No cloud data - use localStorage
            setPodcasts(localData.podcasts);
            setEpisodes(localData.episodes);
            setPlaybackProgress(localData.playbackProgress);
            setBookmarkedEpisodeIds(localData.bookmarkedEpisodeIds);
            setPinnedPodcastIds(localData.pinnedPodcastIds);
            setListeningStats(localData.listeningStats);

            console.log(`Loaded from localStorage: ${localData.podcasts.length} podcasts, ${localData.episodes.length} episodes`);
          }
        } catch (error) {
          console.error("Error loading from Firestore:", error);
          // On error, fall back to localStorage
          const savedPodcasts = localStorage.getItem("litecast-podcasts");
          const savedEpisodes = localStorage.getItem("litecast-episodes");
          const savedProgress = localStorage.getItem("litecast-progress");
          const savedBookmarks = localStorage.getItem("litecast-bookmarks");
          const savedPinned = localStorage.getItem("litecast-pinned");
          const savedStats = localStorage.getItem("litecast-listening-stats");

          if (savedPodcasts) setPodcasts(JSON.parse(savedPodcasts));
          if (savedEpisodes) setEpisodes(JSON.parse(savedEpisodes));
          if (savedProgress) setPlaybackProgress(JSON.parse(savedProgress));
          if (savedBookmarks) setBookmarkedEpisodeIds(JSON.parse(savedBookmarks));
          if (savedPinned) setPinnedPodcastIds(JSON.parse(savedPinned));
          if (savedStats) setListeningStats(JSON.parse(savedStats));
        } finally {
          setIsSyncing(false);
          isSyncingRef.current = false;
        }
      } else {
        // Not logged in - use localStorage
        const savedPodcasts = localStorage.getItem("litecast-podcasts");
        const savedEpisodes = localStorage.getItem("litecast-episodes");
        const savedProgress = localStorage.getItem("litecast-progress");
        const savedBookmarks = localStorage.getItem("litecast-bookmarks");
        const savedPinned = localStorage.getItem("litecast-pinned");
        const savedStats = localStorage.getItem("litecast-listening-stats");

        if (savedPodcasts) setPodcasts(JSON.parse(savedPodcasts));
        if (savedEpisodes) setEpisodes(JSON.parse(savedEpisodes));
        if (savedProgress) setPlaybackProgress(JSON.parse(savedProgress));
        if (savedBookmarks) setBookmarkedEpisodeIds(JSON.parse(savedBookmarks));
        if (savedPinned) setPinnedPodcastIds(JSON.parse(savedPinned));
        if (savedStats) setListeningStats(JSON.parse(savedStats));
      }

      setIsHydrated(true);
    };

    loadData();
  }, [user, authLoading]);

  // Once loaded, check every subscribed feed for episodes we don't have yet.
  // Stored episodes can be missing (a fresh browser loading from Firestore, which
  // may hold none) or stale (new releases since the last fetch).
  useEffect(() => {
    if (!isHydrated || authLoading) return;
    const refreshKey = user?.uid ?? "local";
    if (refreshedForUserRef.current === refreshKey) return;
    refreshedForUserRef.current = refreshKey;

    const feeds = podcasts.filter((p) => p.feedUrl);
    if (feeds.length === 0) return;

    let cancelled = false;
    const refreshFeed = async (podcast: Podcast) => {
      try {
        const response = await fetch(`/api/feed/episodes?url=${encodeURIComponent(podcast.feedUrl)}`);
        const data = await response.json();
        if (cancelled || data.error || !data.episodes?.length) return;

        const fetched: Episode[] = data.episodes.map((ep: FeedEpisode) => toEpisode(ep, podcast));
        setEpisodes((prev) => {
          const existingIds = new Set(prev.map((e) => e.id));
          const missing = fetched.filter((ep) => !existingIds.has(ep.id));
          return missing.length > 0 ? [...prev, ...missing] : prev;
        });
      } catch (error) {
        console.error(`Failed to refresh episodes for ${podcast.title}:`, error);
      }
    };

    const run = async () => {
      const queue = [...feeds];
      const workers = Array.from({ length: Math.min(FEED_REFRESH_CONCURRENCY, queue.length) }, async () => {
        while (!cancelled && queue.length > 0) {
          await refreshFeed(queue.shift()!);
        }
      });
      await Promise.all(workers);
      if (!cancelled) console.log(`Refreshed episodes for ${feeds.length} podcasts`);
    };
    run();

    return () => {
      cancelled = true;
    };
    // podcasts is read once per load; re-running on every change would refetch all feeds
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isHydrated, authLoading, user]);

  // Listen for real-time updates from Firestore (for cross-device sync)
  useEffect(() => {
    if (!user || !db) return;

    const unsubscribe = onSnapshot(doc(db, "users", user.uid), (docSnap) => {
      // Don't update state during initial sync to avoid overwriting local data
      if (docSnap.exists() && !isSyncingRef.current) {
        const cloudData = docSnap.data() as UserData;

        // Only update if cloud has MORE podcasts than local (indicates sync from another device)
        // This prevents cloud data (with limited episodes) from overwriting local data
        setPodcasts(currentPodcasts => {
          if ((cloudData.podcasts?.length || 0) > currentPodcasts.length) {
            // Cloud has more podcasts - merge them
            const localIds = new Set(currentPodcasts.map(p => p.id));
            const newPodcasts = (cloudData.podcasts || []).filter(p => !localIds.has(p.id));
            return [...currentPodcasts, ...newPodcasts];
          }
          return currentPodcasts;
        });

        // Don't overwrite episodes from cloud (local has full data)
        // Only add episodes for new podcasts we don't have
        setEpisodes(currentEpisodes => {
          const localPodcastIds = new Set(currentEpisodes.map(e => e.podcastId));
          const newEpisodes = (cloudData.episodes || []).filter(
            e => !localPodcastIds.has(e.podcastId)
          );
          if (newEpisodes.length > 0) {
            return [...currentEpisodes, ...newEpisodes];
          }
          return currentEpisodes;
        });

        // Merge playback progress (cloud may have progress from other devices)
        setPlaybackProgress(currentProgress => {
          const localIds = new Set(currentProgress.map(p => p.episodeId));
          const newProgress = (cloudData.playbackProgress || []).filter(
            p => !localIds.has(p.episodeId)
          );
          if (newProgress.length > 0) {
            return [...currentProgress, ...newProgress];
          }
          return currentProgress;
        });

        // Merge bookmarks
        setBookmarkedEpisodeIds(currentBookmarks => {
          const merged = new Set([...currentBookmarks, ...(cloudData.bookmarkedEpisodeIds || [])]);
          if (merged.size > currentBookmarks.length) {
            return [...merged];
          }
          return currentBookmarks;
        });
      }
    });

    return () => unsubscribe();
  }, [user]);

  // Save to storage when state changes
  useEffect(() => {
    // Don't save until hydrated and auth is done loading
    if (!isHydrated || authLoading) return;

    const data: UserData = { podcasts, episodes, playbackProgress, bookmarkedEpisodeIds, pinnedPodcastIds, listeningStats };

    // Always save to localStorage as immediate backup
    try {
      localStorage.setItem("litecast-podcasts", JSON.stringify(podcasts));
      localStorage.setItem("litecast-episodes", JSON.stringify(episodes));
      localStorage.setItem("litecast-progress", JSON.stringify(playbackProgress));
      localStorage.setItem("litecast-bookmarks", JSON.stringify(bookmarkedEpisodeIds));
      localStorage.setItem("litecast-pinned", JSON.stringify(pinnedPodcastIds));
      localStorage.setItem("litecast-listening-stats", JSON.stringify(listeningStats));
      console.log(`LocalStorage saved: ${podcasts.length} podcasts, ${episodes.length} episodes`);
    } catch (error: any) {
      console.error("LocalStorage save failed:", error?.message || error);
      // If localStorage is full, try to save at least the podcasts
      if (error?.name === "QuotaExceededError") {
        try {
          localStorage.setItem("litecast-podcasts", JSON.stringify(podcasts));
          localStorage.setItem("litecast-progress", JSON.stringify(playbackProgress));
          localStorage.setItem("litecast-pinned", JSON.stringify(pinnedPodcastIds));
          console.warn("LocalStorage quota exceeded - saved podcasts only, episodes may be incomplete");
        } catch (e) {
          console.error("Even minimal save failed:", e);
        }
      }
    }

    // Debounce Firestore saves to avoid overwhelming the backend
    if (user) {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
      saveTimeoutRef.current = setTimeout(() => {
        saveToFirestore(data);
      }, 2000); // Wait 2 seconds after last change before saving to Firestore
    }

    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, [podcasts, episodes, playbackProgress, bookmarkedEpisodeIds, pinnedPodcastIds, listeningStats, isHydrated, authLoading, user, saveToFirestore]);

  const subscribe = async (podcast: Podcast, feedUrl: string) => {
    if (podcasts.some((p) => p.id === podcast.id)) return;

    try {
      const response = await fetch(`/api/feed/episodes?url=${encodeURIComponent(feedUrl)}`);
      const data = await response.json();

      if (data.error) {
        console.error("Failed to fetch episodes:", data.error);
        return;
      }

      const newPodcast: Podcast = { ...podcast, feedUrl };
      const newEpisodes: Episode[] = (data.episodes || []).map((ep: FeedEpisode) => toEpisode(ep, newPodcast));

      setPodcasts((prev) => [...prev, newPodcast]);
      setEpisodes((prev) => [...prev, ...newEpisodes]);
    } catch (error) {
      console.error("Failed to subscribe:", error);
    }
  };

  const unsubscribe = (podcastId: string) => {
    setPodcasts((prev) => prev.filter((p) => p.id !== podcastId));
    setEpisodes((prev) => prev.filter((e) => e.podcastId !== podcastId));
  };

  const isSubscribed = (podcastId: string) => {
    return podcasts.some((p) => p.id === podcastId);
  };

  const getNewReleases = (sortBy: NewReleasesSortOption = "newest"): Episode[] => {
    const startedEpisodeIds = playbackProgress.map((p) => p.episodeId);
    const unlistenedEpisodes = episodes.filter((ep) => !startedEpisodeIds.includes(ep.id));

    const latestPerPodcast = new Map<string, Episode>();
    for (const ep of unlistenedEpisodes) {
      const existing = latestPerPodcast.get(ep.podcastId);
      if (!existing || new Date(ep.publishedAt) > new Date(existing.publishedAt)) {
        latestPerPodcast.set(ep.podcastId, ep);
      }
    }

    const releases = Array.from(latestPerPodcast.values());

    switch (sortBy) {
      case "newest":
        return releases.sort((a, b) =>
          new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime()
        );

      case "pinned":
        return releases.sort((a, b) => {
          const aPinned = pinnedPodcastIds.includes(a.podcastId);
          const bPinned = pinnedPodcastIds.includes(b.podcastId);
          if (aPinned && !bPinned) return -1;
          if (!aPinned && bPinned) return 1;
          return new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime();
        });

      case "most-listened":
        return releases.sort((a, b) => {
          const aStats = listeningStats.find(s => s.podcastId === a.podcastId);
          const bStats = listeningStats.find(s => s.podcastId === b.podcastId);
          const aScore = aStats ? aStats.playCount + (aStats.totalTimeListened / 3600) : 0;
          const bScore = bStats ? bStats.playCount + (bStats.totalTimeListened / 3600) : 0;
          if (bScore !== aScore) return bScore - aScore;
          return new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime();
        });

      case "oldest":
        return releases.sort((a, b) =>
          new Date(a.publishedAt).getTime() - new Date(b.publishedAt).getTime()
        );

      case "a-z":
        return releases.sort((a, b) =>
          a.podcastTitle.localeCompare(b.podcastTitle)
        );

      default:
        return releases.sort((a, b) =>
          new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime()
        );
    }
  };

  const getInProgressEpisodes = (): (Episode & { progress: number })[] => {
    const inProgressIds = playbackProgress
      .filter((p) => !p.completed && p.currentTime > 0)
      .map((p) => p.episodeId);

    return episodes
      .filter((ep) => inProgressIds.includes(ep.id))
      .map((ep) => {
        const progress = playbackProgress.find((p) => p.episodeId === ep.id)!;
        return {
          ...ep,
          progress: ep.duration > 0 ? Math.round((progress.currentTime / ep.duration) * 100) : 0,
        };
      })
      .sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime());
  };

  const updateProgress = (episodeId: string, currentTime: number, completed: boolean) => {
    setPlaybackProgress((prev) => {
      const existing = prev.find((p) => p.episodeId === episodeId);
      if (existing) {
        return prev.map((p) =>
          p.episodeId === episodeId ? { ...p, currentTime, completed } : p
        );
      }
      return [...prev, { episodeId, currentTime, completed }];
    });
  };

  const toggleBookmark = (episodeId: string) => {
    setBookmarkedEpisodeIds((prev) => {
      if (prev.includes(episodeId)) {
        return prev.filter((id) => id !== episodeId);
      }
      return [...prev, episodeId];
    });
  };

  const isBookmarked = (episodeId: string) => {
    return bookmarkedEpisodeIds.includes(episodeId);
  };

  const fetchAllEpisodes = async (podcastId: string): Promise<{ added: number; total: number }> => {
    const podcast = podcasts.find((p) => p.id === podcastId);
    if (!podcast || !podcast.feedUrl) {
      return { added: 0, total: 0 };
    }

    try {
      // Fetch all episodes (no limit)
      const response = await fetch(`/api/feed/episodes?url=${encodeURIComponent(podcast.feedUrl)}&limit=all`);
      const data = await response.json();

      if (data.error) {
        console.error("Failed to fetch episodes:", data.error);
        return { added: 0, total: 0 };
      }

      const existingIds = new Set(episodes.filter(e => e.podcastId === podcastId).map(e => e.id));

      const newEpisodes: Episode[] = (data.episodes || [])
        .map((ep: FeedEpisode) => toEpisode(ep, podcast))
        .filter((ep: Episode) => !existingIds.has(ep.id));

      if (newEpisodes.length > 0) {
        setEpisodes((prev) => [...prev, ...newEpisodes]);
      }

      return { added: newEpisodes.length, total: data.episodes?.length || 0 };
    } catch (error) {
      console.error("Failed to fetch all episodes:", error);
      return { added: 0, total: 0 };
    }
  };

  const getBookmarkedEpisodes = (): Episode[] => {
    return episodes
      .filter((ep) => bookmarkedEpisodeIds.includes(ep.id))
      .sort((a, b) => {
        const indexA = bookmarkedEpisodeIds.indexOf(a.id);
        const indexB = bookmarkedEpisodeIds.indexOf(b.id);
        return indexB - indexA;
      });
  };

  const togglePin = (podcastId: string) => {
    setPinnedPodcastIds((prev) => {
      if (prev.includes(podcastId)) {
        return prev.filter((id) => id !== podcastId);
      }
      return [...prev, podcastId];
    });
  };

  const isPinned = (podcastId: string) => {
    return pinnedPodcastIds.includes(podcastId);
  };

  const recordPlay = (podcastId: string, duration: number) => {
    setListeningStats((prev) => {
      const existing = prev.find((s) => s.podcastId === podcastId);
      if (existing) {
        return prev.map((s) =>
          s.podcastId === podcastId
            ? {
                ...s,
                playCount: s.playCount + 1,
                totalTimeListened: s.totalTimeListened + duration,
                lastPlayedAt: new Date().toISOString(),
              }
            : s
        );
      }
      return [
        ...prev,
        {
          podcastId,
          playCount: 1,
          totalTimeListened: duration,
          lastPlayedAt: new Date().toISOString(),
        },
      ];
    });
  };

  const getListeningStats = (podcastId: string): ListeningStats | undefined => {
    return listeningStats.find((s) => s.podcastId === podcastId);
  };

  return (
    <SubscriptionContext.Provider
      value={{
        podcasts,
        episodes,
        playbackProgress,
        bookmarkedEpisodeIds,
        pinnedPodcastIds,
        listeningStats,
        isHydrated,
        subscribe,
        unsubscribe,
        isSubscribed,
        getNewReleases,
        getInProgressEpisodes,
        getBookmarkedEpisodes,
        updateProgress,
        toggleBookmark,
        isBookmarked,
        fetchAllEpisodes,
        togglePin,
        isPinned,
        recordPlay,
        getListeningStats,
      }}
    >
      {children}
    </SubscriptionContext.Provider>
  );
}

export function useSubscriptions() {
  const context = useContext(SubscriptionContext);
  if (!context) {
    throw new Error("useSubscriptions must be used within a SubscriptionProvider");
  }
  return context;
}
