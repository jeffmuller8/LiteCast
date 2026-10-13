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

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const url = searchParams.get("url");

  if (!url) {
    return NextResponse.json({ error: "URL is required" }, { status: 400 });
  }

  if (!API_KEY || !API_SECRET) {
    return NextResponse.json(
      { error: "Podcast Index API credentials not configured" },
      { status: 500 }
    );
  }

  try {
    // Use Podcast Index API to get episodes
    const response = await fetch(
      `https://api.podcastindex.org/api/1.0/episodes/byfeedurl?url=${encodeURIComponent(url)}&max=50&fullText=true`,
      {
        headers: getPodcastIndexHeaders(),
      }
    );

    if (!response.ok) {
      console.error("Podcast Index API error:", response.status);
      return NextResponse.json(
        { error: "Failed to fetch episodes from Podcast Index" },
        { status: 500 }
      );
    }

    const data = await response.json();

    if (!data.items || data.items.length === 0) {
      return NextResponse.json({ episodes: [] });
    }

    const episodes = data.items.map((item: any, index: number) => ({
      id: item.guid || item.id?.toString() || `${url}-ep-${index}-${item.title || index}`,
      title: item.title || "Untitled Episode",
      description: item.description || item.contentEncoded || item.summary || "",
      audioUrl: item.enclosureUrl || "",
      duration: item.duration || 0,
      publishedAt: item.datePublished
        ? new Date(item.datePublished * 1000).toISOString()
        : new Date().toISOString(),
      transcriptUrl: item.transcriptUrl || undefined,
    }));

    return NextResponse.json({ episodes });
  } catch (error) {
    console.error("Feed episodes fetch error:", error);
    return NextResponse.json(
      { error: "Failed to fetch episodes" },
      { status: 500 }
    );
  }
}
