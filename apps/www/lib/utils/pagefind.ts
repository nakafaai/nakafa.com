import { normalizeLocalizedInternalHref } from "@repo/internationalization/src/href";
import type { PagefindResult } from "@/types/pagefind";

const HTML_ANCHOR_REGEX = /\.html#/;
const HTML_EXT_REGEX = /\.html$/;

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

/** Normalize one Pagefind result payload for locale-aware app navigation. */
export function normalizePagefindResult(
  result: PagefindResult
): PagefindResult {
  return {
    ...result,
    url: normalizePagefindPath(result.url),
    sub_results: result.sub_results.map((subResult) => ({
      ...subResult,
      url: getPagefindSubResultHref(subResult),
    })),
  };
}
