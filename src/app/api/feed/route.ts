import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const url = searchParams.get("url");

  if (!url) {
    return NextResponse.json({ error: "URL is required" }, { status: 400 });
  }

  try {
    const response = await fetch(url, {
      headers: {
        "User-Agent": "LiteCast/1.0",
        Accept: "application/rss+xml, application/xml, text/xml",
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch feed: ${response.status}`);
    }

    const xml = await response.text();

    // Parse the RSS feed
    const titleMatch = xml.match(/<title>(?:<!\[CDATA\[)?(.*?)(?:\]\]>)?<\/title>/);
    const descMatch = xml.match(/<description>(?:<!\[CDATA\[)?(.*?)(?:\]\]>)?<\/description>/s);
    const authorMatch = xml.match(/<itunes:author>(?:<!\[CDATA\[)?(.*?)(?:\]\]>)?<\/itunes:author>/) ||
                        xml.match(/<author>(?:<!\[CDATA\[)?(.*?)(?:\]\]>)?<\/author>/);
    const imageMatch = xml.match(/<itunes:image\s+href=["']([^"']+)["']/) ||
                       xml.match(/<image>[\s\S]*?<url>([^<]+)<\/url>[\s\S]*?<\/image>/);

    // Count episodes
    const episodeCount = (xml.match(/<item>/g) || []).length;

    const podcast = {
      id: Buffer.from(url).toString("base64"),
      title: titleMatch?.[1]?.trim() || "Unknown Podcast",
      author: authorMatch?.[1]?.trim() || "Unknown Author",
      description: descMatch?.[1]?.trim().substring(0, 500) || "",
      image: imageMatch?.[1] || "",
      url: url,
      episodeCount,
    };

    return NextResponse.json({ podcast });
  } catch (error) {
    console.error("Feed fetch error:", error);
    return NextResponse.json(
      { error: "Failed to fetch or parse RSS feed" },
      { status: 500 }
    );
  }
}
