import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";

const API_KEY = process.env.PODCASTINDEX_API_KEY || "";
const API_SECRET = process.env.PODCASTINDEX_API_SECRET || "";

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const query = searchParams.get("q");

  if (!query) {
    return NextResponse.json({ feeds: [] });
  }

  if (!API_KEY || !API_SECRET) {
    return NextResponse.json(
      { error: "Podcast Index API credentials not configured" },
      { status: 500 }
    );
  }

  // Generate authentication headers for Podcast Index API
  const apiHeaderTime = Math.floor(Date.now() / 1000);
  const hash = crypto
    .createHash("sha1")
    .update(API_KEY + API_SECRET + apiHeaderTime)
    .digest("hex");

  try {
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

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error("Search error:", error);
    return NextResponse.json(
      { error: "Failed to search podcasts" },
      { status: 500 }
    );
  }
}
