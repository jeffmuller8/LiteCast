import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";

const API_KEY = process.env.PODCASTINDEX_API_KEY || "";
const API_SECRET = process.env.PODCASTINDEX_API_SECRET || "";

// Search using iTunes API (free, no auth required)
async function searchWithiTunes(query: string) {
  const response = await fetch(
    `https://itunes.apple.com/search?term=${encodeURIComponent(query)}&media=podcast&limit=20`,
    { next: { revalidate: 300 } } // Cache for 5 minutes
  );

  if (!response.ok) {
    throw new Error(`iTunes API error: ${response.status}`);
  }

  const data = await response.json();

  // Transform iTunes results to match Podcast Index format
  const feeds = data.results.map((item: any) => ({
    id: item.collectionId,
    title: item.collectionName,
    author: item.artistName,
    description: item.collectionName, // iTunes doesn't provide description in search
    image: item.artworkUrl600 || item.artworkUrl100,
    url: item.feedUrl,
    categories: item.genres || [],
  }));

  return { feeds };
}

// Search using Podcast Index API (requires credentials)
async function searchWithPodcastIndex(query: string) {
  const apiHeaderTime = Math.floor(Date.now() / 1000);
  const hash = crypto
    .createHash("sha1")
    .update(API_KEY + API_SECRET + apiHeaderTime)
    .digest("hex");

  const response = await fetch(
    `https://api.podcastindex.org/api/1.0/search/byterm?q=${encodeURIComponent(query)}`,
    {
      headers: {
        "X-Auth-Date": apiHeaderTime.toString(),
        "X-Auth-Key": API_KEY,
        Authorization: hash,
        "User-Agent": "LiteCast/1.0",
      },
    }
  );

  if (!response.ok) {
    throw new Error(`Podcast Index API error: ${response.status}`);
  }

  return response.json();
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const query = searchParams.get("q");

  if (!query) {
    return NextResponse.json({ feeds: [] });
  }

  try {
    // Use Podcast Index if credentials are available, otherwise fall back to iTunes
    if (API_KEY && API_SECRET) {
      const data = await searchWithPodcastIndex(query);
      return NextResponse.json(data);
    } else {
      const data = await searchWithiTunes(query);
      return NextResponse.json(data);
    }
  } catch (error) {
    console.error("Search error:", error);
    return NextResponse.json(
      { error: "Failed to search podcasts" },
      { status: 500 }
    );
  }
}
