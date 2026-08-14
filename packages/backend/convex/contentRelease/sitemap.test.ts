import { compareSitemapPaths } from "@repo/backend/convex/contentRelease/sitemap";
import { describe, expect, it } from "vitest";

describe("current content sitemap", () => {
  it("matches Convex UTF-8 index order for punctuation and umlauts", () => {
    const paths = [
      "curriculum/z",
      "curriculum/ä",
      "curriculum/a/1",
      "curriculum/a-1",
    ];

    expect(paths.sort(compareSitemapPaths)).toEqual([
      "curriculum/a-1",
      "curriculum/a/1",
      "curriculum/z",
      "curriculum/ä",
    ]);
  });
});
