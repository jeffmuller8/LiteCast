"use client";

import { createContext, useContext, useState, useEffect, ReactNode } from "react";

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

interface SubscriptionContextType {
  podcasts: Podcast[];
  episodes: Episode[];
  playbackProgress: PlaybackProgress[];
  bookmarkedEpisodeIds: string[];
  isHydrated: boolean;
  subscribe: (podcast: Podcast, feedUrl: string) => Promise<void>;
  unsubscribe: (podcastId: string) => void;
  isSubscribed: (podcastId: string) => boolean;
  getNewReleases: () => Episode[];
  getInProgressEpisodes: () => (Episode & { progress: number })[];
  getBookmarkedEpisodes: () => Episode[];
  updateProgress: (episodeId: string, currentTime: number, completed: boolean) => void;
  toggleBookmark: (episodeId: string) => void;
  isBookmarked: (episodeId: string) => boolean;
}

const SubscriptionContext = createContext<SubscriptionContextType | null>(null);

export function SubscriptionProvider({ children }: { children: ReactNode }) {
  const [podcasts, setPodcasts] = useState<Podcast[]>([]);
  const [episodes, setEpisodes] = useState<Episode[]>([]);
  const [playbackProgress, setPlaybackProgress] = useState<PlaybackProgress[]>([]);
  const [bookmarkedEpisodeIds, setBookmarkedEpisodeIds] = useState<string[]>([]);
  const [isHydrated, setIsHydrated] = useState(false);

  // Load from localStorage on mount
  useEffect(() => {
    const savedPodcasts = localStorage.getItem("litecast-podcasts");
    const savedEpisodes = localStorage.getItem("litecast-episodes");
    const savedProgress = localStorage.getItem("litecast-progress");
    const savedBookmarks = localStorage.getItem("litecast-bookmarks");

    if (savedPodcasts) setPodcasts(JSON.parse(savedPodcasts));
    if (savedEpisodes) setEpisodes(JSON.parse(savedEpisodes));
    if (savedProgress) setPlaybackProgress(JSON.parse(savedProgress));
    if (savedBookmarks) setBookmarkedEpisodeIds(JSON.parse(savedBookmarks));

    setIsHydrated(true);
  }, []);

  // Save to localStorage when state changes (only after hydration)
  useEffect(() => {
    if (isHydrated) {
      localStorage.setItem("litecast-podcasts", JSON.stringify(podcasts));
    }
  }, [podcasts, isHydrated]);

  useEffect(() => {
    if (isHydrated) {
      localStorage.setItem("litecast-episodes", JSON.stringify(episodes));
    }
  }, [episodes, isHydrated]);

  useEffect(() => {
    if (isHydrated) {
      localStorage.setItem("litecast-progress", JSON.stringify(playbackProgress));
    }
  }, [playbackProgress, isHydrated]);

  useEffect(() => {
    if (isHydrated) {
      localStorage.setItem("litecast-bookmarks", JSON.stringify(bookmarkedEpisodeIds));
    }
  }, [bookmarkedEpisodeIds, isHydrated]);

  const subscribe = async (podcast: Podcast, feedUrl: string) => {
    // Check if already subscribed
    if (podcasts.some((p) => p.id === podcast.id)) return;

    try {
      // Fetch episodes from the feed
      const response = await fetch(`/api/feed/episodes?url=${encodeURIComponent(feedUrl)}`);
      const data = await response.json();

      if (data.error) {
        console.error("Failed to fetch episodes:", data.error);
        return;
      }

      // Add podcast to library
      const newPodcast: Podcast = {
        ...podcast,
        feedUrl,
      };
      setPodcasts((prev) => [...prev, newPodcast]);

      // Add all episodes from the feed
      const newEpisodes: Episode[] = (data.episodes || []).map((ep: any) => ({
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
      }));

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

  const getNewReleases = (): Episode[] => {
    const startedEpisodeIds = playbackProgress.map((p) => p.episodeId);

    // Get unlistened episodes
    const unlistenedEpisodes = episodes.filter((ep) => !startedEpisodeIds.includes(ep.id));

    // Group by podcast and get only the most recent per podcast
    const latestPerPodcast = new Map<string, Episode>();
    for (const ep of unlistenedEpisodes) {
      const existing = latestPerPodcast.get(ep.podcastId);
      if (!existing || new Date(ep.publishedAt) > new Date(existing.publishedAt)) {
        latestPerPodcast.set(ep.podcastId, ep);
      }
    }

    // Return sorted by date
    return Array.from(latestPerPodcast.values())
      .sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime());
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

  const getBookmarkedEpisodes = (): Episode[] => {
    return episodes
      .filter((ep) => bookmarkedEpisodeIds.includes(ep.id))
      .sort((a, b) => {
        // Sort by when they were bookmarked (order in the array)
        const indexA = bookmarkedEpisodeIds.indexOf(a.id);
        const indexB = bookmarkedEpisodeIds.indexOf(b.id);
        return indexB - indexA; // Most recently bookmarked first
      });
  };

  return (
    <SubscriptionContext.Provider
      value={{
        podcasts,
        episodes,
        playbackProgress,
        bookmarkedEpisodeIds,
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
