export interface Podcast {
  id: string;
  title: string;
  author: string;
  description: string;
  artworkUrl: string;
  feedUrl: string;
  episodeCount: number;
}

export interface Episode {
  id: string;
  podcastId: string;
  title: string;
  description: string;
  audioUrl: string;
  duration: number; // in seconds
  publishedAt: string;
  artworkUrl?: string;
}

export interface EpisodeWithPodcast extends Episode {
  podcastTitle: string;
  podcastArtworkUrl: string;
}

export interface PlaybackProgress {
  episodeId: string;
  currentTime: number; // in seconds
  completed: boolean;
}

// Simulated playback progress data
export const mockPlaybackProgress: PlaybackProgress[] = [
  { episodeId: "e3", currentTime: 1800, completed: false }, // 25% through Huberman episode
  { episodeId: "e5", currentTime: 2400, completed: false }, // 66% through Syntax episode
  { episodeId: "e2", currentTime: 1800, completed: true },  // Completed
  { episodeId: "e6", currentTime: 2700, completed: true },  // Completed
];

export const mockPodcasts: Podcast[] = [
  {
    id: "1",
    title: "The Daily",
    author: "The New York Times",
    description: "This is what the news should sound like. The biggest stories of our time, told by the best journalists in the world.",
    artworkUrl: "https://picsum.photos/seed/daily/400/400",
    feedUrl: "https://example.com/daily",
    episodeCount: 1500,
  },
  {
    id: "2",
    title: "Huberman Lab",
    author: "Andrew Huberman",
    description: "Discuss neuroscience and science-based tools for everyday life.",
    artworkUrl: "https://picsum.photos/seed/huberman/400/400",
    feedUrl: "https://example.com/huberman",
    episodeCount: 200,
  },
  {
    id: "3",
    title: "Syntax",
    author: "Wes Bos & Scott Tolinski",
    description: "A Tasty Treats Podcast for Web Developers.",
    artworkUrl: "https://picsum.photos/seed/syntax/400/400",
    feedUrl: "https://example.com/syntax",
    episodeCount: 800,
  },
  {
    id: "4",
    title: "How I Built This",
    author: "Guy Raz / NPR",
    description: "Stories behind the movements and the people who built them.",
    artworkUrl: "https://picsum.photos/seed/built/400/400",
    feedUrl: "https://example.com/built",
    episodeCount: 500,
  },
];

export const mockEpisodes: Episode[] = [
  {
    id: "e1",
    podcastId: "1",
    title: "The Sunday Read: 'The Teenagers Who Hacked Microsoft'",
    description: "A group of teenagers became some of the most skilled hackers on the planet.",
    audioUrl: "https://example.com/audio1.mp3",
    duration: 2340,
    publishedAt: "2024-01-15T10:00:00Z",
  },
  {
    id: "e2",
    podcastId: "1",
    title: "The Fight Over A.I. in Hollywood",
    description: "How artificial intelligence is reshaping the entertainment industry.",
    audioUrl: "https://example.com/audio2.mp3",
    duration: 1800,
    publishedAt: "2024-01-14T10:00:00Z",
  },
  {
    id: "e3",
    podcastId: "2",
    title: "How to Focus & Change Your Brain",
    description: "Science-based tools to improve concentration and neural plasticity.",
    audioUrl: "https://example.com/audio3.mp3",
    duration: 7200,
    publishedAt: "2024-01-13T10:00:00Z",
  },
  {
    id: "e4",
    podcastId: "2",
    title: "Master Your Sleep & Be More Alert",
    description: "Understanding the science of sleep for optimal performance.",
    audioUrl: "https://example.com/audio4.mp3",
    duration: 5400,
    publishedAt: "2024-01-10T10:00:00Z",
  },
  {
    id: "e5",
    podcastId: "3",
    title: "React Server Components Explained",
    description: "Deep dive into RSC and how they change React development.",
    audioUrl: "https://example.com/audio5.mp3",
    duration: 3600,
    publishedAt: "2024-01-12T10:00:00Z",
  },
  {
    id: "e6",
    podcastId: "3",
    title: "TypeScript Tips & Tricks",
    description: "Advanced TypeScript patterns for cleaner code.",
    audioUrl: "https://example.com/audio6.mp3",
    duration: 2700,
    publishedAt: "2024-01-08T10:00:00Z",
  },
  {
    id: "e7",
    podcastId: "4",
    title: "Airbnb: Joe Gebbia",
    description: "How three roommates turned air mattresses into a $100 billion company.",
    audioUrl: "https://example.com/audio7.mp3",
    duration: 3000,
    publishedAt: "2024-01-11T10:00:00Z",
  },
];

export const getLatestEpisodes = (): EpisodeWithPodcast[] => {
  return mockEpisodes
    .map((ep) => {
      const podcast = mockPodcasts.find((p) => p.id === ep.podcastId)!;
      return {
        ...ep,
        podcastTitle: podcast.title,
        podcastArtworkUrl: podcast.artworkUrl,
      };
    })
    .sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime());
};

export const getEpisodesByPodcast = (podcastId: string): Episode[] => {
  return mockEpisodes.filter((ep) => ep.podcastId === podcastId);
};

export const searchPodcasts = (query: string): Podcast[] => {
  const q = query.toLowerCase();
  return mockPodcasts.filter(
    (p) => p.title.toLowerCase().includes(q) || p.author.toLowerCase().includes(q)
  );
};

export const formatDuration = (seconds: number): string => {
  const totalSeconds = Math.floor(seconds);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const secs = totalSeconds % 60;

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  }
  return `${minutes}:${secs.toString().padStart(2, "0")}`;
};

export const formatDate = (dateString: string): string => {
  const date = new Date(dateString);
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
};

// Get episodes that have not been started (no playback progress)
export const getNewReleases = (): EpisodeWithPodcast[] => {
  const startedEpisodeIds = mockPlaybackProgress.map((p) => p.episodeId);
  return mockEpisodes
    .filter((ep) => !startedEpisodeIds.includes(ep.id))
    .map((ep) => {
      const podcast = mockPodcasts.find((p) => p.id === ep.podcastId)!;
      return {
        ...ep,
        podcastTitle: podcast.title,
        podcastArtworkUrl: podcast.artworkUrl,
      };
    })
    .sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime());
};

// Get episodes that have been started but not completed
export const getInProgressEpisodes = (): (EpisodeWithPodcast & { progress: number })[] => {
  const inProgressIds = mockPlaybackProgress
    .filter((p) => !p.completed && p.currentTime > 0)
    .map((p) => p.episodeId);

  return mockEpisodes
    .filter((ep) => inProgressIds.includes(ep.id))
    .map((ep) => {
      const podcast = mockPodcasts.find((p) => p.id === ep.podcastId)!;
      const progress = mockPlaybackProgress.find((p) => p.episodeId === ep.id)!;
      return {
        ...ep,
        podcastTitle: podcast.title,
        podcastArtworkUrl: podcast.artworkUrl,
        progress: Math.round((progress.currentTime / ep.duration) * 100),
      };
    })
    .sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime());
};

// Get playback progress for an episode
export const getEpisodeProgress = (episodeId: string): PlaybackProgress | undefined => {
  return mockPlaybackProgress.find((p) => p.episodeId === episodeId);
};
