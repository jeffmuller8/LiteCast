// A small rolling log of player events, kept in localStorage so it survives the page
// being frozen or reloaded on a phone. Settings > Playback lets you copy it out for
// debugging background playback.

const KEY = "litecast-playback-log";
const MAX_ENTRIES = 150;

export interface PlaybackLogEntry {
  at: string; // ISO time
  event: string;
  details?: Record<string, string | number | boolean | null>;
}

export function logPlayback(event: string, details?: PlaybackLogEntry["details"]) {
  try {
    const entries: PlaybackLogEntry[] = JSON.parse(localStorage.getItem(KEY) || "[]");
    entries.push({ at: new Date().toISOString(), event, details });
    localStorage.setItem(KEY, JSON.stringify(entries.slice(-MAX_ENTRIES)));
  } catch {
    // Storage unavailable or full; logging is best-effort
  }
}

export function getPlaybackLog(): PlaybackLogEntry[] {
  try {
    return JSON.parse(localStorage.getItem(KEY) || "[]");
  } catch {
    return [];
  }
}

export function clearPlaybackLog() {
  try {
    localStorage.removeItem(KEY);
  } catch {
    // Ignore
  }
}

// One line per event, easy to paste into a chat
export function formatPlaybackLog(entries: PlaybackLogEntry[]): string {
  return entries
    .map((e) => {
      const time = e.at.slice(11, 23);
      const details = e.details
        ? " " + Object.entries(e.details).map(([k, v]) => `${k}=${v}`).join(" ")
        : "";
      return `${time} ${e.event}${details}`;
    })
    .join("\n");
}
