import { NextRequest, NextResponse } from "next/server";
import { fetchFeedXml, privateFeedId, FeedFetchError } from "@/lib/fetch-feed";

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const url = searchParams.get("url");
  // Private links (with access tokens) get an id that doesn't encode the link itself
  const isPrivate = searchParams.get("private") === "1";

  if (!url) {
    return NextResponse.json({ error: "URL is required" }, { status: 400 });
  }

  try {
    const xml = await fetchFeedXml(url);
    if (!/<rss[\s>]|<channel[\s>]/.test(xml)) {
      return NextResponse.json({ error: "That link isn't a podcast feed" }, { status: 422 });
    }

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
      id: isPrivate ? privateFeedId(url) : Buffer.from(url).toString("base64"),
      title: titleMatch?.[1]?.trim() || "Unknown Podcast",
      author: authorMatch?.[1]?.trim() || "Unknown Author",
      description: descMatch?.[1]?.trim().substring(0, 500) || "",
      image: imageMatch?.[1] || "",
      url: url,
      episodeCount,
    };

    return NextResponse.json({ podcast });
  } catch (error) {
    console.error("Feed fetch error:", error instanceof Error ? error.message : error);
    if (error instanceof FeedFetchError) {
      const message = error.status === 401 || error.status === 403
        ? "The feed refused access. Check that you copied the whole link."
        : error.status === 404
          ? "No feed found at that link"
          : error.message;
      return NextResponse.json({ error: message }, { status: 502 });
    }
    return NextResponse.json(
      { error: "Failed to fetch or parse RSS feed" },
      { status: 500 }
    );
  }
}
