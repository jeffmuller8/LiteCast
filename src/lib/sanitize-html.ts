import DOMPurify from "dompurify";

// Show notes come from podcast feeds, which anyone can publish (and anyone can add by link),
// so their HTML is untrusted. DOMPurify keeps a small set of formatting tags and drops
// everything else, including scripts, event-handler attributes and non-web link schemes.

const ALLOWED_TAGS = ["a", "p", "br", "strong", "em", "b", "i", "ul", "ol", "li", "span", "div"];
const ALLOWED_ATTR = ["href"];
const LINK_CLASS = "text-light-primary dark:text-sky-400 hover:text-light-primary/80 dark:hover:text-sky-300 underline";

let hooksAdded = false;

function addLinkHook() {
  if (hooksAdded) return;
  hooksAdded = true;
  DOMPurify.addHook("afterSanitizeAttributes", (node) => {
    if (node.tagName !== "A") return;
    const href = node.getAttribute("href") || "";
    // Only plain web and mail links survive
    if (!/^(https?:|mailto:)/i.test(href.trim())) {
      node.removeAttribute("href");
    }
    node.setAttribute("target", "_blank");
    node.setAttribute("rel", "noopener noreferrer");
    node.setAttribute("class", LINK_CLASS);
  });
}

export function sanitizeShowNotes(html: string): string {
  // DOMPurify needs a DOM. Expanded show notes only render in the browser, so on the
  // server return nothing rather than unsanitized HTML.
  if (typeof window === "undefined") return "";
  addLinkHook();
  // Some feeds double-escape their HTML; decode it first so it renders as formatting,
  // then sanitize the decoded markup
  const decoded = html
    .replace(/&nbsp;/g, " ")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, "&");
  return DOMPurify.sanitize(decoded, { ALLOWED_TAGS, ALLOWED_ATTR, ALLOW_DATA_ATTR: false });
}
