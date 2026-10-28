import crypto from "crypto";

// Server-side RSS fetch shared by the feed API routes.
// Private podcast links (Patreon, Supercast, Substack...) sometimes embed a username and
// password (https://user:pass@host/feed); fetch() rejects URLs with credentials, so they're
// moved into a Basic auth header instead.

export class FeedFetchError extends Error {
  constructor(message: string, public status?: number) {
    super(message);
  }
}

export async function fetchFeedXml(feedUrl: string): Promise<string> {
  let url: URL;
  try {
    url = new URL(feedUrl);
  } catch {
    throw new FeedFetchError("That doesn't look like a valid link");
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") {
    throw new FeedFetchError("Only http and https links are supported");
  }

  const headers: Record<string, string> = {
    "User-Agent": "LiteCast/1.0",
    Accept: "application/rss+xml, application/xml, text/xml",
  };
  if (url.username || url.password) {
    const credentials = `${decodeURIComponent(url.username)}:${decodeURIComponent(url.password)}`;
    headers.Authorization = `Basic ${Buffer.from(credentials).toString("base64")}`;
    url.username = "";
    url.password = "";
  }

  const response = await fetch(url, { headers, cache: "no-store" });
  if (!response.ok) {
    throw new FeedFetchError(`Failed to fetch feed: ${response.status}`, response.status);
  }
  return response.text();
}

// Stable id for a private feed that doesn't expose the link (and its token) in page URLs
export function privateFeedId(feedUrl: string): string {
  return `private-${crypto.createHash("sha256").update(feedUrl).digest("hex").slice(0, 16)}`;
}
