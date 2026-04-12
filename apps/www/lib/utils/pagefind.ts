import { normalizeLocalizedInternalHref } from "@repo/internationalization/src/href";
import type { PagefindResult } from "@/types/pagefind";

const HTML_ANCHOR_REGEX = /\.html#/;
const HTML_EXT_REGEX = /\.html$/;
const EMPTY_HTML_TAG_REGEX = /<([a-z]+)(?:\s[^>]*)?>\s*<\/\1>/gi;
const HTML_TAG_REGEX = /<[^>]+>/g;
const HTML_TOKEN_REGEX = /(<[^>]+>)/g;

/** Strip the static `.html` suffix that Pagefind stores for app pages. */
function normalizePagefindPath(path: string) {
  const href = path.replace(HTML_EXT_REGEX, "").replace(HTML_ANCHOR_REGEX, "#");

  return normalizeLocalizedInternalHref(href);
}

/** Remove any existing hash from one href before applying a new anchor id. */
function stripHash(href: string) {
  const hashIndex = href.indexOf("#");

  if (hashIndex === -1) {
    return href;
  }

  return href.slice(0, hashIndex);
}

/**
 * Removes a repeated leading title from one Pagefind HTML excerpt while keeping
 * the remaining markup intact.
 */
function trimExcerptPrefix(title: string, excerpt: string) {
  const plainExcerpt = excerpt.replace(HTML_TAG_REGEX, "").trim();

  if (!plainExcerpt) {
    return excerpt;
  }

  const escapedTitle = title.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = plainExcerpt.match(
    new RegExp(`^${escapedTitle}(?:[\\s.:-]+)?`, "i")
  );

  if (!match?.[0]) {
    return excerpt;
  }

  let remaining = match[0].length;
  const tokens = excerpt.split(HTML_TOKEN_REGEX);

  return tokens
    .map((token) => {
      if (remaining === 0 || token.startsWith("<")) {
        return token;
      }

      if (token.length <= remaining) {
        remaining -= token.length;
        return "";
      }

      const trimmed = token.slice(remaining);
      remaining = 0;
      return trimmed;
    })
    .join("")
    .replace(EMPTY_HTML_TAG_REGEX, "")
    .trim();
}

/** Build the final app-internal href for one Pagefind sub-result. */
export function getPagefindSubResultHref(
  subResult: PagefindResult["sub_results"][number]
) {
  const href = normalizePagefindPath(subResult.url);

  if (!subResult.anchor?.id) {
    return href;
  }

  return `${stripHash(href)}#${subResult.anchor.id}`;
}

/**
 * Returns the sub-results that should be rendered as clickable items.
 *
 * Pagefind can emit a first sub-result that repeats the page title with no
 * anchor. When richer section results also exist, rendering that first item as a
 * clickable row creates a duplicate title in the UI. In that case we drop the
 * duplicate row and only render anchored section hits as list items.
 */
export function getPagefindSectionResults(result: PagefindResult) {
  const [firstSubResult, ...restSubResults] = result.sub_results;

  if (!firstSubResult) {
    return result.sub_results.slice(0, 0);
  }

  const hasSectionResults = restSubResults.length > 0;
  const isPageSummary =
    firstSubResult.title === result.meta.title && !firstSubResult.anchor?.id;

  if (!(isPageSummary && hasSectionResults)) {
    return result.sub_results;
  }

  return restSubResults;
}

/** Returns whether one HTML excerpt still contains visible text. */
export function hasPagefindExcerpt(excerpt: string) {
  return excerpt.replace(HTML_TAG_REGEX, "").trim().length > 0;
}

/** Normalize one Pagefind result payload for locale-aware app navigation. */
export function normalizePagefindResult(
  result: PagefindResult
): PagefindResult {
  return {
    ...result,
    url: normalizePagefindPath(result.url),
    sub_results: result.sub_results.map((subResult) => ({
      ...subResult,
      excerpt: trimExcerptPrefix(subResult.title, subResult.excerpt),
      url: getPagefindSubResultHref(subResult),
    })),
  };
}
