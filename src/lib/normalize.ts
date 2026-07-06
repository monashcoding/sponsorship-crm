// Normalize a company name for fuzzy-dedupe (§5): lowercase, strip punctuation and
// common legal suffixes, collapse whitespace. Order matters — punctuation is stripped
// first so "Pty. Ltd." becomes "pty ltd" before the suffix words are removed.
const SUFFIXES = /\b(pty\s+ltd|pty|ltd|inc|llc|limited|co|corp|corporation|group)\b/g;

export function normalizeName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ") // strip punctuation (unicode-aware)
    .replace(/\s+/g, " ")
    .trim()
    .replace(SUFFIXES, " ")
    .replace(/\s+/g, " ")
    .trim();
}
