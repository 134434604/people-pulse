import { createHash } from "node:crypto";

const EMAIL = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi;
const SLACK_MENTION = /<@[A-Z0-9]+>/gi;
const SLACK_ID = /\b[UW][A-Z0-9]{7,}\b/g;
const URL = /https?:\/\/\S+/gi;
const CONTROL = /[\u0000-\u001F\u007F]/g;

export function sha256(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

export function deterministicId(prefix: string, value: string): string {
  return `${prefix}_${sha256(value).slice(0, 16)}`;
}

export function sanitizeSlackText(value: string): string {
  return value
    .replace(EMAIL, "[email removed]")
    .replace(SLACK_MENTION, "[person]")
    .replace(SLACK_ID, "[identifier removed]")
    .replace(URL, "[link]")
    .replace(CONTROL, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function boundedEvidenceSummary(value: string, maximumCharacters = 80): string {
  const sanitized = sanitizeSlackText(value);
  if (sanitized.length <= maximumCharacters) return sanitized;
  const slice = sanitized.slice(0, Math.max(1, maximumCharacters - 1));
  const wordBoundary = slice.lastIndexOf(" ");
  const bounded = wordBoundary >= maximumCharacters / 2 ? slice.slice(0, wordBoundary) : slice;
  return `${bounded.trimEnd()}…`;
}

export function containsProhibitedIdentifier(value: string): boolean {
  return new RegExp(EMAIL.source, "i").test(value)
    || new RegExp(SLACK_MENTION.source, "i").test(value)
    || new RegExp(SLACK_ID.source).test(value);
}
