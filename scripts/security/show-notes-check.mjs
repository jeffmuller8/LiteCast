// Checks the show-notes sanitizer (src/lib/sanitize-html.ts) with harmless test markup:
// formatting and web links survive; inline event attributes, images, data/id attributes
// and non-web link schemes are removed.
// Usage: node scripts/security/show-notes-check.mjs
import { JSDOM } from "jsdom";

const { window } = new JSDOM("<!doctype html><html><body></body></html>");
globalThis.window = window;
globalThis.document = window.document;
const { sanitizeShowNotes } = await import("../../src/lib/sanitize-html.ts");

const input = [
  '<p>Hello <strong>bold</strong> <a href="https://example.com">web</a> <a href="mailto:a@example.com">mail</a></p>',
  '<p class="h" onclick="window.flag=1" data-test="x" id="y">attribute test</p>',
  '<a href="ftp://example.com">other scheme</a>',
  '<img src="https://example.com/x.png">',
  "&lt;em&gt;escaped&lt;/em&gt;",
].join("");

const out = new JSDOM(`<body>${sanitizeShowNotes(input)}</body>`).window.document.body;
const attrTest = [...out.querySelectorAll("p")].find((p) => p.textContent === "attribute test");
const otherLink = [...out.querySelectorAll("a")].find((a) => a.textContent === "other scheme");

const checks = [
  ["formatting kept", !!out.querySelector("strong")],
  ["https link kept", !!out.querySelector('a[href="https://example.com"]')],
  ["mailto link kept", !!out.querySelector('a[href="mailto:a@example.com"]')],
  ["links open safely (rel=noopener)", [...out.querySelectorAll("a")].every((a) => a.rel.includes("noopener"))],
  ["inline event attribute removed", attrTest && !attrTest.hasAttribute("onclick")],
  ["data/id attributes removed", attrTest && !attrTest.hasAttribute("data-test") && !attrTest.hasAttribute("id")],
  ["non-web link scheme removed", otherLink && !otherLink.hasAttribute("href")],
  ["image removed", !out.querySelector("img")],
  ["double-escaped HTML renders", !!out.querySelector("em")],
];

let failed = false;
for (const [name, ok] of checks) {
  if (!ok) failed = true;
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}`);
}
process.exit(failed ? 1 : 0);
