import { NextRequest, NextResponse } from "next/server";
import { safeFetch, BlockedUrlError } from "@/lib/safe-fetch";

interface TranscriptSegment {
  start: number; // seconds
  end: number;
  text: string;
}

// Parse SRT format
function parseSRT(content: string): TranscriptSegment[] {
  const segments: TranscriptSegment[] = [];
  const blocks = content.trim().split(/\n\n+/);

  for (const block of blocks) {
    const lines = block.split("\n");
    if (lines.length < 3) continue;

    // Find timestamp line (format: 00:00:00,000 --> 00:00:00,000)
    const timestampLine = lines.find((line) => line.includes("-->"));
    if (!timestampLine) continue;

    const [startStr, endStr] = timestampLine.split("-->").map((s) => s.trim());
    const start = parseTimestamp(startStr);
    const end = parseTimestamp(endStr);

    // Get text (everything after timestamp, excluding index line)
    const textLines = lines.slice(lines.indexOf(timestampLine) + 1);
    const text = textLines.join(" ").trim();

    if (text) {
      segments.push({ start, end, text });
    }
  }

  return segments;
}

// Parse VTT format
function parseVTT(content: string): TranscriptSegment[] {
  const segments: TranscriptSegment[] = [];
  // Remove WEBVTT header and metadata
  const contentWithoutHeader = content.replace(/^WEBVTT[\s\S]*?\n\n/, "");
  const blocks = contentWithoutHeader.trim().split(/\n\n+/);

  for (const block of blocks) {
    const lines = block.split("\n");
    if (lines.length < 2) continue;

    // Find timestamp line (format: 00:00:00.000 --> 00:00:00.000)
    const timestampLine = lines.find((line) => line.includes("-->"));
    if (!timestampLine) continue;

    const [startStr, endStr] = timestampLine.split("-->").map((s) => s.trim().split(" ")[0]);
    const start = parseTimestamp(startStr);
    const end = parseTimestamp(endStr);

    // Get text (everything after timestamp)
    const textLines = lines.slice(lines.indexOf(timestampLine) + 1);
    const text = textLines
      .join(" ")
      .replace(/<[^>]*>/g, "") // Remove VTT tags like <v Speaker>
      .trim();

    if (text) {
      segments.push({ start, end, text });
    }
  }

  return segments;
}

// Parse JSON transcript format (Podcast Index format)
function parseJSON(content: string): TranscriptSegment[] {
  try {
    const data = JSON.parse(content);

    // Handle Podcast Index format
    if (data.segments) {
      return data.segments.map((seg: any) => ({
        start: seg.startTime || seg.start || 0,
        end: seg.endTime || seg.end || 0,
        text: seg.body || seg.text || "",
      }));
    }

    // Handle array format
    if (Array.isArray(data)) {
      return data.map((seg: any) => ({
        start: seg.startTime || seg.start || 0,
        end: seg.endTime || seg.end || 0,
        text: seg.body || seg.text || seg.content || "",
      }));
    }

    return [];
  } catch {
    return [];
  }
}

// Parse timestamp string to seconds
function parseTimestamp(timestamp: string): number {
  // Handle formats: HH:MM:SS,mmm or HH:MM:SS.mmm or MM:SS.mmm
  const cleaned = timestamp.replace(",", ".").trim();
  const parts = cleaned.split(":");

  if (parts.length === 3) {
    const [hours, minutes, seconds] = parts.map(parseFloat);
    return hours * 3600 + minutes * 60 + seconds;
  } else if (parts.length === 2) {
    const [minutes, seconds] = parts.map(parseFloat);
    return minutes * 60 + seconds;
  }

  return parseFloat(cleaned) || 0;
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const url = searchParams.get("url");

  if (!url) {
    return NextResponse.json({ error: "URL is required" }, { status: 400 });
  }

  try {
    // Transcript URLs come from feeds, so only public addresses are fetched
    const response = await safeFetch(url, {
      headers: {
        "User-Agent": "LiteCast/1.0",
        Accept: "text/plain, application/json, text/vtt, text/srt, */*",
      },
    });

    if (!response.ok) {
      return NextResponse.json(
        { error: `Failed to fetch transcript: ${response.status}` },
        { status: 500 }
      );
    }

    const contentType = response.headers.get("content-type") || "";
    const content = await response.text();

    let segments: TranscriptSegment[] = [];

    // Detect format and parse
    if (contentType.includes("json") || content.trim().startsWith("{") || content.trim().startsWith("[")) {
      segments = parseJSON(content);
    } else if (content.includes("WEBVTT") || contentType.includes("vtt")) {
      segments = parseVTT(content);
    } else if (content.includes("-->")) {
      // Could be SRT or VTT without header
      segments = content.includes(",") ? parseSRT(content) : parseVTT(content);
    } else {
      // Plain text - treat as single segment
      segments = [{ start: 0, end: 0, text: content.trim() }];
    }

    return NextResponse.json({ segments });
  } catch (error) {
    if (error instanceof BlockedUrlError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    console.error("Transcript fetch error:", error);
    return NextResponse.json(
      { error: "Failed to fetch or parse transcript" },
      { status: 500 }
    );
  }
}
