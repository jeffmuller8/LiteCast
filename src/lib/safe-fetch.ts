import { lookup } from "dns/promises";
import net from "net";

// The feed and transcript routes fetch URLs that users (or feeds) supply. This keeps them
// from being pointed at the server's own network: only http(s) to public addresses, and
// every redirect hop is checked the same way.

const MAX_REDIRECTS = 5;

export class BlockedUrlError extends Error {}

function isPrivateIPv4(ip: string): boolean {
  const [a, b] = ip.split(".").map(Number);
  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    (a === 100 && b >= 64 && b <= 127) || // carrier-grade NAT
    (a === 169 && b === 254) || // link-local
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 192 && b === 0) ||
    (a === 198 && (b === 18 || b === 19)) ||
    a >= 224 // multicast and reserved
  );
}

function isPrivateIP(ip: string): boolean {
  if (net.isIPv4(ip)) return isPrivateIPv4(ip);
  const lower = ip.toLowerCase();
  const mapped = lower.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
  if (mapped) return isPrivateIPv4(mapped[1]);
  return (
    lower === "::" ||
    lower === "::1" ||
    lower.startsWith("fc") ||
    lower.startsWith("fd") || // unique local
    /^fe[89ab]/.test(lower) // link-local
  );
}

async function assertPublicUrl(url: URL) {
  if (url.protocol !== "https:" && url.protocol !== "http:") {
    throw new BlockedUrlError("Only http and https links are supported");
  }
  const host = url.hostname.replace(/^\[|\]$/g, "");
  if (host === "localhost" || host.endsWith(".localhost") || host.endsWith(".internal")) {
    throw new BlockedUrlError("That address isn't allowed");
  }
  const addresses = net.isIP(host)
    ? [{ address: host }]
    : await lookup(host, { all: true }).catch(() => {
        throw new BlockedUrlError("Couldn't find that site");
      });
  if (addresses.length === 0 || addresses.some((a) => isPrivateIP(a.address))) {
    throw new BlockedUrlError("That address isn't allowed");
  }
}

// fetch() for user-supplied URLs: validates the target and each redirect before following it
export async function safeFetch(input: string | URL, init: RequestInit = {}): Promise<Response> {
  let url = new URL(input);
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    await assertPublicUrl(url);
    const response = await fetch(url, { ...init, redirect: "manual" });
    const location = response.headers.get("location");
    if (response.status >= 300 && response.status < 400 && location) {
      url = new URL(location, url);
      continue;
    }
    return response;
  }
  throw new BlockedUrlError("Too many redirects");
}
