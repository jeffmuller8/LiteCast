"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { Search, Plus, Check, Loader2, Rss, TrendingUp, Clock } from "lucide-react";
import Image from "next/image";
import { useSubscriptions } from "@/lib/subscription-context";

interface PodcastResult {
  id: number | string;
  title: string;
  author: string;
  description: string;
  image: string;
  url: string;
  originalUrl?: string;
  episodeCount?: number;
}

// Popular/trending search suggestions
const POPULAR_SEARCHES = [
  "Joe Rogan",
  "True Crime",
  "Lex Fridman",
  "The Daily",
  "Huberman Lab",
  "Conan O'Brien",
  "Armchair Expert",
  "SmartLess",
  "Call Her Daddy",
  "Crime Junkie",
];

// Recent searches stored in localStorage
const RECENT_SEARCHES_KEY = "litecast-recent-searches";
const MAX_RECENT_SEARCHES = 5;

function isUrl(str: string): boolean {
  return str.startsWith("http://") || str.startsWith("https://");
}

function getRecentSearches(): string[] {
  if (typeof window === "undefined") return [];
  const stored = localStorage.getItem(RECENT_SEARCHES_KEY);
  return stored ? JSON.parse(stored) : [];
}

function addRecentSearch(query: string) {
  if (typeof window === "undefined" || !query.trim() || isUrl(query)) return;
  const recent = getRecentSearches();
  const filtered = recent.filter((s) => s.toLowerCase() !== query.toLowerCase());
  const updated = [query, ...filtered].slice(0, MAX_RECENT_SEARCHES);
  localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(updated));
}

export default function SearchPage() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<PodcastResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [subscribingIds, setSubscribingIds] = useState<Set<number | string>>(new Set());
  const [isRssFeed, setIsRssFeed] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const [filteredSuggestions, setFilteredSuggestions] = useState<string[]>([]);

  const inputRef = useRef<HTMLInputElement>(null);
  const suggestionsRef = useRef<HTMLDivElement>(null);

  const { subscribe, isSubscribed, isLoading: isSubscribing } = useSubscriptions();

  // Load recent searches on mount
  useEffect(() => {
    setRecentSearches(getRecentSearches());
  }, []);

  // Filter suggestions based on partial query
  useEffect(() => {
    if (query.length === 0 || isUrl(query)) {
      setFilteredSuggestions([]);
      return;
    }

    const lowerQuery = query.toLowerCase();
    const matches = POPULAR_SEARCHES.filter((s) =>
      s.toLowerCase().includes(lowerQuery)
    );
    setFilteredSuggestions(matches.slice(0, 5));
  }, [query]);

  // Close suggestions when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        suggestionsRef.current &&
        !suggestionsRef.current.contains(event.target as Node) &&
        inputRef.current &&
        !inputRef.current.contains(event.target as Node)
      ) {
        setShowSuggestions(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Debounced search
  useEffect(() => {
    if (query.length === 0) {
      setResults([]);
      setError(null);
      setIsRssFeed(false);
      return;
    }

    const isRss = isUrl(query);
    setIsRssFeed(isRss);

    if (!isRss && query.length < 2) return;

    const timer = setTimeout(async () => {
      setIsLoading(true);
      setError(null);
      setShowSuggestions(false);

      try {
        if (isRss) {
          // Fetch RSS feed directly
          const response = await fetch(`/api/feed?url=${encodeURIComponent(query)}`);
          const data = await response.json();

          if (data.error) {
            setError(data.error);
            setResults([]);
          } else if (data.podcast) {
            // Store the feed URL for subscription
            setResults([{ ...data.podcast, originalUrl: query }]);
          }
        } else {
          // Search Podcast Index
          const response = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
          const data = await response.json();

          if (data.error) {
            setError(data.error);
            setResults([]);
          } else {
            setResults(data.feeds || []);
            // Save to recent searches if we got results
            if (data.feeds?.length > 0) {
              addRecentSearch(query);
              setRecentSearches(getRecentSearches());
            }
          }
        }
      } catch (err) {
        setError("Failed to search. Please try again.");
        setResults([]);
      } finally {
        setIsLoading(false);
      }
    }, isRss ? 100 : 400);

    return () => clearTimeout(timer);
  }, [query]);

  const handleSubscribe = async (podcast: PodcastResult) => {
    const podcastId = String(podcast.id);
    if (isSubscribed(podcastId)) return;

    setSubscribingIds((prev) => new Set([...prev, podcast.id]));

    // Get the feed URL - either from originalUrl (RSS) or url (Podcast Index)
    const feedUrl = podcast.originalUrl || podcast.url;

    await subscribe(
      {
        id: podcastId,
        title: podcast.title,
        author: podcast.author,
        description: podcast.description,
        artworkUrl: podcast.image,
        feedUrl,
      },
      feedUrl
    );

    setSubscribingIds((prev) => {
      const next = new Set(prev);
      next.delete(podcast.id);
      return next;
    });
  };

  const handleSearch = async (searchQuery: string) => {
    if (!searchQuery.trim() || searchQuery.length < 2) return;

    const isRss = isUrl(searchQuery);
    setIsLoading(true);
    setError(null);
    setShowSuggestions(false);

    try {
      if (isRss) {
        const response = await fetch(`/api/feed?url=${encodeURIComponent(searchQuery)}`);
        const data = await response.json();

        if (data.error) {
          setError(data.error);
          setResults([]);
        } else if (data.podcast) {
          setResults([{ ...data.podcast, originalUrl: searchQuery }]);
        }
      } else {
        const response = await fetch(`/api/search?q=${encodeURIComponent(searchQuery)}`);
        const data = await response.json();

        if (data.error) {
          setError(data.error);
          setResults([]);
        } else {
          setResults(data.feeds || []);
          if (data.feeds?.length > 0) {
            addRecentSearch(searchQuery);
            setRecentSearches(getRecentSearches());
          }
        }
      }
    } catch (err) {
      setError("Failed to search. Please try again.");
      setResults([]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSuggestionClick = (suggestion: string) => {
    setQuery(suggestion);
    setShowSuggestions(false);
    handleSearch(suggestion);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleSearch(query);
    }
  };

  const showSuggestionsPanel = showSuggestions && query.length === 0 && (recentSearches.length > 0 || POPULAR_SEARCHES.length > 0);
  const showPartialSuggestions = showSuggestions && query.length > 0 && filteredSuggestions.length > 0 && !isUrl(query);

  return (
    <div className="p-4 md:p-8 animate-fadeIn">
      {/* Search input */}
      <div className="relative mb-6 md:mb-8">
        {isRssFeed ? (
          <Rss className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-orange-400" />
        ) : (
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 dark:text-zinc-400" />
        )}
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => setShowSuggestions(true)}
          onKeyDown={handleKeyDown}
          placeholder="Search podcasts or paste RSS feed URL..."
          className={`w-full pl-12 pr-4 py-3 bg-light-surface dark:bg-zinc-800 border rounded-xl text-light-text dark:text-white placeholder:text-gray-400 dark:placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:border-transparent ${
            isRssFeed
              ? "border-orange-500/50 focus:ring-orange-500"
              : "border-gray-200 dark:border-zinc-700 focus:ring-light-primary dark:focus:ring-sky-500"
          }`}
        />

        {/* Suggestions dropdown */}
        {(showSuggestionsPanel || showPartialSuggestions) && (
          <div
            ref={suggestionsRef}
            className="absolute top-full left-0 right-0 mt-2 bg-white dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded-xl shadow-xl z-50 overflow-hidden"
          >
            {/* Partial match suggestions */}
            {showPartialSuggestions && (
              <div className="p-2">
                {filteredSuggestions.map((suggestion) => (
                  <button
                    key={suggestion}
                    onClick={() => handleSuggestionClick(suggestion)}
                    className="w-full px-3 py-2 text-left text-sm text-light-text dark:text-zinc-200 hover:bg-gray-100 dark:hover:bg-zinc-700 rounded-lg flex items-center gap-3 transition-colors"
                  >
                    <Search className="w-4 h-4 text-gray-400 dark:text-zinc-500" />
                    <span>
                      {suggestion.split(new RegExp(`(${query})`, "gi")).map((part, i) =>
                        part.toLowerCase() === query.toLowerCase() ? (
                          <span key={i} className="text-light-primary dark:text-sky-400 font-medium">{part}</span>
                        ) : (
                          <span key={i}>{part}</span>
                        )
                      )}
                    </span>
                  </button>
                ))}
              </div>
            )}

            {/* Empty state suggestions */}
            {showSuggestionsPanel && (
              <>
                {/* Recent searches */}
                {recentSearches.length > 0 && (
                  <div className="p-2 border-b border-gray-200 dark:border-zinc-700">
                    <p className="px-3 py-1 text-xs font-medium text-gray-500 dark:text-zinc-500 flex items-center gap-2">
                      <Clock className="w-3 h-3" />
                      Recent Searches
                    </p>
                    {recentSearches.map((search) => (
                      <button
                        key={search}
                        onClick={() => handleSuggestionClick(search)}
                        className="w-full px-3 py-2 text-left text-sm text-light-text dark:text-zinc-200 hover:bg-gray-100 dark:hover:bg-zinc-700 rounded-lg flex items-center gap-3 transition-colors"
                      >
                        <Clock className="w-4 h-4 text-gray-400 dark:text-zinc-500" />
                        {search}
                      </button>
                    ))}
                  </div>
                )}

                {/* Trending/Popular */}
                <div className="p-2">
                  <p className="px-3 py-1 text-xs font-medium text-gray-500 dark:text-zinc-500 flex items-center gap-2">
                    <TrendingUp className="w-3 h-3" />
                    Popular Searches
                  </p>
                  <div className="flex flex-wrap gap-2 px-3 py-2">
                    {POPULAR_SEARCHES.slice(0, 8).map((search) => (
                      <button
                        key={search}
                        onClick={() => handleSuggestionClick(search)}
                        className="px-3 py-1.5 text-sm text-gray-600 dark:text-zinc-300 bg-gray-100 dark:bg-zinc-700/50 hover:bg-gray-200 dark:hover:bg-zinc-700 rounded-full transition-colors"
                      >
                        {search}
                      </button>
                    ))}
                  </div>
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {/* RSS indicator */}
      {isRssFeed && query.length > 0 && (
        <div className="flex items-center gap-2 mb-4 text-sm text-orange-400">
          <Rss className="w-4 h-4" />
          <span>RSS feed detected</span>
        </div>
      )}

      {/* Results */}
      {query.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <Search className="w-16 h-16 text-gray-300 dark:text-zinc-700 mb-4" />
          <h2 className="text-xl font-semibold text-gray-500 dark:text-zinc-400">
            Search for podcasts
          </h2>
          <p className="text-gray-400 dark:text-zinc-500 mt-2 max-w-md">
            Search the Podcast Index directory or paste an RSS feed URL to subscribe directly
          </p>
        </div>
      ) : isLoading ? (
        <div className="flex flex-col items-center justify-center py-20">
          <Loader2 className="w-8 h-8 text-light-primary dark:text-sky-500 animate-spin" />
          <p className="text-gray-500 dark:text-zinc-400 mt-4">Searching...</p>
        </div>
      ) : error ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <h2 className="text-xl font-semibold text-red-500 dark:text-red-400">
            {error}
          </h2>
          <p className="text-gray-500 dark:text-zinc-500 mt-2">
            Make sure API keys are configured in .env.local
          </p>
        </div>
      ) : results.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <h2 className="text-xl font-semibold text-gray-500 dark:text-zinc-400">
            No results found
          </h2>
          <p className="text-gray-400 dark:text-zinc-500 mt-2">
            Try a different search term
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {results.map((podcast) => (
            <div
              key={podcast.id}
              onClick={() => router.push(`/podcast/${encodeURIComponent(String(podcast.id))}`)}
              className="flex gap-4 p-4 rounded-xl bg-light-surface/50 dark:bg-zinc-800/50 hover:bg-light-surface dark:hover:bg-zinc-800 transition-colors group cursor-pointer"
            >
              {podcast.image ? (
                <Image
                  src={podcast.image}
                  alt={podcast.title}
                  width={80}
                  height={80}
                  className="rounded-lg object-cover"
                  unoptimized
                />
              ) : (
                <div className="w-20 h-20 bg-gray-200 dark:bg-zinc-700 rounded-lg flex items-center justify-center">
                  <Search className="w-8 h-8 text-gray-400 dark:text-zinc-500" />
                </div>
              )}
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-light-text dark:text-white group-hover:text-light-primary dark:group-hover:text-sky-400 transition-colors">
                  {podcast.title}
                </h3>
                <p className="text-sm text-gray-500 dark:text-zinc-400 mt-1">
                  {podcast.author}
                  {podcast.episodeCount && (
                    <span className="text-gray-400 dark:text-zinc-500"> • {podcast.episodeCount} episodes</span>
                  )}
                </p>
                <p className="text-sm text-gray-400 dark:text-zinc-500 mt-2 line-clamp-2">
                  {podcast.description}
                </p>
              </div>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleSubscribe(podcast);
                }}
                disabled={isSubscribed(String(podcast.id)) || subscribingIds.has(podcast.id)}
                className={`flex-shrink-0 w-12 h-12 rounded-full flex items-center justify-center transition-all ${
                  isSubscribed(String(podcast.id))
                    ? "bg-gray-200 dark:bg-zinc-700 text-gray-400 dark:text-zinc-400 cursor-default"
                    : "bg-light-primary dark:bg-sky-600 text-white hover:bg-light-primary/90 dark:hover:bg-sky-500"
                }`}
              >
                {subscribingIds.has(podcast.id) ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : isSubscribed(String(podcast.id)) ? (
                  <Check className="w-5 h-5" />
                ) : (
                  <Plus className="w-5 h-5" />
                )}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
