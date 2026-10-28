// Checks that LiteCast's Firestore can't be read without signing in.
// Makes one unauthenticated list request and reports only the status (never document data).
// Usage: node scripts/security/firestore-open-check.mjs
const PROJECT = "litecast-c7d80";
const url = `https://firestore.googleapis.com/v1/projects/${PROJECT}/databases/(default)/documents/users?pageSize=1&mask.fieldPaths=updatedAt`;

const res = await fetch(url);
const body = await res.json().catch(() => ({}));
if (res.ok) {
  console.log(`FAIL  unauthenticated read allowed (HTTP ${res.status}, ${(body.documents || []).length} doc returned)`);
  process.exit(1);
}
console.log(`PASS  unauthenticated read refused (HTTP ${res.status} ${body.error?.status ?? ""})`);
