import { Predicate } from "effect";

const TITLE_LENGTH = 55;
const TITLE_SEPARATOR = " - ";

/** Fits prioritized title parts and the site name within the app's title budget. */
export function createSEOTitle(
  parts: readonly unknown[],
  siteName = "Nakafa"
): string {
  const site = truncateAtWordBoundary(siteName, TITLE_LENGTH);
  const contentLength = TITLE_LENGTH - TITLE_SEPARATOR.length - site.length;
  if (contentLength <= 0) {
    return site;
  }

  let title = "";
  for (const part of parts) {
    if (!Predicate.isString(part)) {
      continue;
    }
    const text = part.trim();
    if (!text) {
      continue;
    }
    if (!title) {
      title = truncateAtWordBoundary(text, contentLength);
      continue;
    }

    const candidate = `${title}${TITLE_SEPARATOR}${text}`;
    if (candidate.length > contentLength) {
      break;
    }
    title = candidate;
  }

  return title ? `${title}${TITLE_SEPARATOR}${site}` : site;
}

/** Keeps complete trailing words when a title segment exceeds its budget. */
function truncateAtWordBoundary(text: string, length: number) {
  if (text.length <= length) {
    return text;
  }
  const truncated = text.slice(0, length);
  const lastSpace = truncated.lastIndexOf(" ");
  return (lastSpace > 0 ? truncated.slice(0, lastSpace) : truncated).trim();
}
