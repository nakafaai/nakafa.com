import { Order } from "effect";

/** Maximum current signed routes returned by one sitemap page. */
export const CONTENT_SITEMAP_ROUTE_PAGE_SIZE = 1000;

/** Matches Convex UTF-8 index order for deterministic sitemap paths. */
export const compareSitemapPaths = Order.make<string>((left, right) => {
  let leftIndex = 0;
  let rightIndex = 0;
  while (true) {
    const leftCodePoint = left.codePointAt(leftIndex);
    const rightCodePoint = right.codePointAt(rightIndex);
    if (leftCodePoint === undefined || rightCodePoint === undefined) {
      return Order.Boolean(
        leftCodePoint !== undefined,
        rightCodePoint !== undefined
      );
    }
    if (leftCodePoint !== rightCodePoint) {
      return Order.Number(leftCodePoint, rightCodePoint);
    }
    leftIndex += leftCodePoint > 0xff_ff ? 2 : 1;
    rightIndex += rightCodePoint > 0xff_ff ? 2 : 1;
  }
});
