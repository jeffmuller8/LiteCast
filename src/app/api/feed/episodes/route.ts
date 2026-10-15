import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";

const API_KEY = process.env.PODCASTINDEX_API_KEY || "";
const API_SECRET = process.env.PODCASTINDEX_API_SECRET || "";

function getPodcastIndexHeaders() {
  const apiHeaderTime = Math.floor(Date.now() / 1000);
  const hash = crypto
    .createHash("sha1")
    .update(API_KEY + API_SECRET + apiHeaderTime)
    .digest("hex");

  return {
    "X-Auth-Date": apiHeaderTime.toString(),
    "X-Auth-Key": API_KEY,
    Authorization: hash,
    "User-Agent": "LiteCast/1.0",
  };
}

// Parse duration string (HH:MM:SS or MM:SS or seconds) to seconds
function parseDuration(duration: string | number | undefined): number {
  if (!duration) return 0;
  if (typeof duration === "number") return duration;

  const parts = duration.split(":").map(Number);
  if (parts.length === 3) {
    return parts[0] * 3600 + parts[1] * 60 + parts[2];
  } else if (parts.length === 2) {
    return parts[0] * 60 + parts[1];
  }
  return parseInt(duration) || 0;
}

// Extract CDATA or plain text content
function extractContent(match: RegExpMatchArray | null): string {
  if (!match) return "";
  const content = match[1] || "";
  // Remove CDATA wrapper if present
  return content.replace(/^<!\[CDATA\[/, "").replace(/\]\]>$/, "").trim();
}

// Fetch and parse RSS feed directly
async function fetchEpisodesFromRSS(feedUrl: string, maxEpisodes: number) {
  const response = await fetch(feedUrl, {
    headers: {
      "User-Agent": "LiteCast/1.0",
      Accept: "application/rss+xml, application/xml, text/xml",
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch feed: ${response.status}`);
  }

  const xml = await response.text();

  // Parse episodes from <item> elements
  const itemRegex = /<item>([\s\S]*?)<\/item>/g;
  const episodes: any[] = [];
  let match;
  let index = 0;

  while ((match = itemRegex.exec(xml)) !== null && index < maxEpisodes) {
    const itemXml = match[1];

    // Extract episode data
    const titleMatch = itemXml.match(/<title>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/title>/);
    const descMatch = itemXml.match(/<description>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/description>/) ||
                      itemXml.match(/<itunes:summary>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/itunes:summary>/);
    const guidMatch = itemXml.match(/<guid[^>]*>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/guid>/);
    const enclosureMatch = itemXml.match(/<enclosure[^>]+url=["']([^"']+)["'][^>]*>/);
    const durationMatch = itemXml.match(/<itunes:duration>([^<]+)<\/itunes:duration>/);
    const pubDateMatch = itemXml.match(/<pubDate>([^<]+)<\/pubDate>/);

    const audioUrl = enclosureMatch?.[1] || "";
    if (!audioUrl) {
      // Skip items without audio
      continue;
    }

    const title = extractContent(titleMatch) || "Untitled Episode";
    const guid = extractContent(guidMatch) || `${feedUrl}-ep-${index}-${title}`;

    episodes.push({
      id: guid,
      title,
      description: extractContent(descMatch),
      audioUrl,
      duration: parseDuration(durationMatch?.[1]),
      publishedAt: pubDateMatch?.[1]
        ? new Date(pubDateMatch[1]).toISOString()
        : new Date().toISOString(),
    });

    index++;
  }

  return episodes;
}

// Fetch episodes using Podcast Index API
async function fetchEpisodesFromPodcastIndex(feedUrl: string, maxEpisodes: number) {
  const response = await fetch(
    `https://api.podcastindex.org/api/1.0/episodes/byfeedurl?url=${encodeURIComponent(feedUrl)}&max=${maxEpisodes}&fullText=true`,
    {
      headers: getPodcastIndexHeaders(),
    }
  );

  if (!response.ok) {
    throw new Error(`Podcast Index API error: ${response.status}`);
  }

  const data = await response.json();

  if (!data.items || data.items.length === 0) {
    return [];
  }

  return data.items.map((item: any, index: number) => ({
    id: item.guid || item.id?.toString() || `${feedUrl}-ep-${index}-${item.title || index}`,
    title: item.title || "Untitled Episode",
    description: item.description || item.contentEncoded || item.summary || "",
    audioUrl: item.enclosureUrl || "",
    duration: item.duration || 0,
    publishedAt: item.datePublished
      ? new Date(item.datePublished * 1000).toISOString()
      : new Date().toISOString(),
    transcriptUrl: item.transcriptUrl || undefined,
  }));
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const url = searchParams.get("url");
  const limitParam = searchParams.get("limit");

  if (!url) {
    return NextResponse.json({ error: "URL is required" }, { status: 400 });
  }

  // Determine max episodes to fetch (default 50, "all" = 1000)
  const maxEpisodes = limitParam === "all" ? 1000 : (parseInt(limitParam || "50") || 50);

  try {
    let episodes;

    // Use Podcast Index if credentials are available, otherwise parse RSS directly
    if (API_KEY && API_SECRET) {
      episodes = await fetchEpisodesFromPodcastIndex(url, maxEpisodes);
    } else {
      episodes = await fetchEpisodesFromRSS(url, maxEpisodes);
    }

    return NextResponse.json({ episodes });
  } catch (error) {
    console.error("Feed episodes fetch error:", error);
    return NextResponse.json(
      { error: "Failed to fetch episodes" },
      { status: 500 }
    );
  }
}
