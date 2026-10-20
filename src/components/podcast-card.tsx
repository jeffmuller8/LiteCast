"use client";

import Image from "next/image";
import Link from "next/link";

interface Podcast {
  id: string;
  title: string;
  author: string;
  description?: string;
  artworkUrl: string;
}

interface PodcastCardProps {
  podcast: Podcast;
  newEpisodeCount?: number;
}

export function PodcastCard({ podcast, newEpisodeCount = 0 }: PodcastCardProps) {
  return (
    <Link
      href={`/podcast/${podcast.id}`}
      className="group block"
    >
      <div className="relative mb-3">
        <div className="relative aspect-square rounded-lg overflow-hidden border border-gray-300 dark:border-zinc-700 shadow-sm group-hover:shadow-md dark:shadow-black/10 dark:group-hover:shadow-black/20 transition-shadow">
          <Image
            src={podcast.artworkUrl}
            alt={podcast.title}
            fill
            className="object-cover group-hover:scale-105 transition-transform duration-300"
            unoptimized
          />
        </div>
        {newEpisodeCount > 0 && (
          <span
            className="absolute -top-2 -right-2 min-w-[24px] h-6 px-1.5 flex items-center justify-center rounded-full bg-light-primary dark:bg-sky-600 text-white text-xs font-semibold shadow-md ring-2 ring-light-bg dark:ring-zinc-950"
            aria-label={`${newEpisodeCount} new episode${newEpisodeCount === 1 ? "" : "s"}`}
          >
            {newEpisodeCount > 99 ? "99+" : newEpisodeCount}
          </span>
        )}
      </div>
      <h3 className="font-medium text-light-text dark:text-white truncate group-hover:text-light-primary dark:group-hover:text-sky-400 transition-colors">
        {podcast.title}
      </h3>
      <p className="text-sm text-gray-500 dark:text-zinc-400 truncate">{podcast.author}</p>
    </Link>
  );
}

// Compact list row for the mobile library. The count sits at the end of the row,
// since a corner badge would cover much of a small thumbnail.
export function PodcastListRow({ podcast, newEpisodeCount = 0 }: PodcastCardProps) {
  return (
    <Link
      href={`/podcast/${podcast.id}`}
      className="flex items-center gap-3 py-2.5 group"
    >
      <div className="relative w-[50px] h-[50px] flex-shrink-0 rounded-lg overflow-hidden border border-gray-300 dark:border-zinc-700">
        <Image
          src={podcast.artworkUrl}
          alt={podcast.title}
          fill
          className="object-cover"
          unoptimized
        />
      </div>
      <div className="flex-1 min-w-0">
        <h3 className="text-sm font-medium text-light-text dark:text-white truncate group-active:text-light-primary dark:group-active:text-sky-400">
          {podcast.title}
        </h3>
        <p className="text-xs text-gray-500 dark:text-zinc-400 truncate">{podcast.author}</p>
      </div>
      {newEpisodeCount > 0 && (
        <span
          className="min-w-[22px] h-[22px] px-1.5 flex flex-shrink-0 items-center justify-center rounded-full bg-light-primary dark:bg-sky-600 text-white text-xs font-semibold"
          aria-label={`${newEpisodeCount} new episode${newEpisodeCount === 1 ? "" : "s"}`}
        >
          {newEpisodeCount > 99 ? "99+" : newEpisodeCount}
        </span>
      )}
    </Link>
  );
}

export function PodcastCardLarge({ podcast }: PodcastCardProps) {
  return (
    <Link
      href={`/podcast/${podcast.id}`}
      className="flex gap-4 p-4 rounded-xl bg-light-surface dark:bg-zinc-800/50 hover:bg-gray-200 dark:hover:bg-zinc-800 transition-all group border border-gray-300 dark:border-zinc-700 shadow-sm hover:shadow-md dark:shadow-black/10 dark:hover:shadow-black/20"
    >
      <Image
        src={podcast.artworkUrl}
        alt={podcast.title}
        width={80}
        height={80}
        className="rounded-lg"
      />
      <div className="flex-1 min-w-0">
        <h3 className="font-semibold text-light-text dark:text-white group-hover:text-light-primary dark:group-hover:text-sky-400 transition-colors">
          {podcast.title}
        </h3>
        <p className="text-sm text-gray-500 dark:text-zinc-400 mt-1">{podcast.author}</p>
        <p className="text-sm text-gray-400 dark:text-zinc-500 mt-2 line-clamp-2">
          {podcast.description}
        </p>
      </div>
    </Link>
  );
}
