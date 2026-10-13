import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";

const API_KEY = process.env.PODCASTINDEX_API_KEY || "";
const API_SECRET = process.env.PODCASTINDEX_API_SECRET || "";

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

  const apiHeaderTime = Math.floor(Date.now() / 1000);
  const hash = crypto
    .createHash("sha1")
    .update(API_KEY + API_SECRET + apiHeaderTime)
    .digest("hex");

  try {
    const response = await fetch(
      `https://api.podcastindex.org/api/1.0/podcasts/byfeedurl?url=${encodeURIComponent(url)}`,
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
      return NextResponse.json(
        { error: "Podcast not found" },
        { status: 404 }
      );
    }

    const data = await response.json();

    if (!data.feed) {
      return NextResponse.json(
        { error: "Podcast not found" },
        { status: 404 }
      );
    }

    const feed = data.feed;

    return NextResponse.json({
      podcast: {
        id: feed.id?.toString() || feed.podcastGuid || url,
        title: feed.title || "Unknown Podcast",
        author: feed.author || feed.ownerName || "",
        description: feed.description || "",
        artworkUrl: feed.artwork || feed.image || "",
        feedUrl: feed.url || url,
      },
    });
  } catch (error) {
    console.error("Podcast lookup error:", error);
    return NextResponse.json(
      { error: "Failed to look up podcast" },
      { status: 500 }
    );
  }
}
