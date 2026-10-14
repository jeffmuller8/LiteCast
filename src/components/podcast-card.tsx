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
}

export function PodcastCard({ podcast }: PodcastCardProps) {
  return (
    <Link
      href={`/podcast/${podcast.id}`}
      className="group block"
    >
      <div className="relative aspect-square rounded-lg overflow-hidden mb-3 border border-gray-300 dark:border-zinc-700 shadow-sm group-hover:shadow-md dark:shadow-black/10 dark:group-hover:shadow-black/20 transition-shadow">
        <Image
          src={podcast.artworkUrl}
          alt={podcast.title}
          fill
          className="object-cover group-hover:scale-105 transition-transform duration-300"
          unoptimized
        />
      </div>
      <h3 className="font-medium text-light-text dark:text-white truncate group-hover:text-light-primary dark:group-hover:text-sky-400 transition-colors">
        {podcast.title}
      </h3>
      <p className="text-sm text-gray-500 dark:text-zinc-400 truncate">{podcast.author}</p>
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
