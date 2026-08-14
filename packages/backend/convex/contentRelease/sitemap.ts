/** Maximum current signed routes returned by one sitemap page. */
export const CONTENT_SITEMAP_ROUTE_PAGE_SIZE = 1000;

/** Matches Convex UTF-8 index order for deterministic sitemap paths. */
export function compareSitemapPaths(left: string, right: string) {
  let leftIndex = 0;
  let rightIndex = 0;

  while (leftIndex < left.length && rightIndex < right.length) {
    const leftCodePoint = left.codePointAt(leftIndex);
    const rightCodePoint = right.codePointAt(rightIndex);

    if (leftCodePoint === undefined || rightCodePoint === undefined) {
      break;
    }
    if (leftCodePoint !== rightCodePoint) {
      return leftCodePoint - rightCodePoint;
    }

    leftIndex += leftCodePoint > 0xff_ff ? 2 : 1;
    rightIndex += rightCodePoint > 0xff_ff ? 2 : 1;
  }

  return left.length - leftIndex - (right.length - rightIndex);
}
