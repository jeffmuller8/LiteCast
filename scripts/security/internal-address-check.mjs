// Checks that the feed and transcript routes refuse to fetch internal addresses.
// Starts a throwaway listener on 127.0.0.1, asks each route to fetch it (and other internal
// addresses), and fails if any request reaches the listener or a route doesn't refuse.
// Usage: node scripts/security/internal-address-check.mjs [baseUrl]   (default http://localhost:3000)
import http from "node:http";

const base = process.argv[2] || "http://localhost:3000";
const hits = [];
const listener = http.createServer((req, res) => {
  hits.push(req.url);
  res.end("ok");
});
await new Promise((resolve) => listener.listen(0, "127.0.0.1", resolve));
const port = listener.address().port;

const targets = [
  ["feed", `http://127.0.0.1:${port}/check-feed`],
  ["transcript", `http://127.0.0.1:${port}/check-transcript`],
  ["feed", `http://localhost:${port}/check-hostname`],
  ["feed", `http://[::1]:${port}/check-ipv6`],
  ["transcript", "http://169.254.169.254/"],
];

let failed = false;
for (const [route, target] of targets) {
  const res = await fetch(`${base}/api/${route}?url=${encodeURIComponent(target)}`);
  const refused = res.status === 400;
  if (!refused) failed = true;
  console.log(`${refused ? "PASS" : "FAIL"}  ${route.padEnd(10)} ${target}  -> HTTP ${res.status}`);
}

listener.close();
if (hits.length > 0) {
  failed = true;
  console.log(`FAIL  listener received ${hits.length} request(s): ${hits.join(", ")}`);
} else {
  console.log("PASS  listener received no requests");
}
process.exit(failed ? 1 : 0);
