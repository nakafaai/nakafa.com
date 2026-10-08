import { describe, expect, it } from "@effect/vitest";
import { compareSitemapPaths } from "@repo/backend/confect/contentRelease/sitemap";
import { Array as Arr } from "effect";

describe("current content sitemap", () => {
  it("matches Convex UTF-8 index order for punctuation and umlauts", () => {
    const paths = [
      "curriculum/z",
      "curriculum/ä",
      "curriculum/a/1",
      "curriculum/a-1",
      "curriculum/\u{10000}",
      "curriculum/\ue000",
      "curriculum/a",
    ];

    expect(Arr.sort(paths, compareSitemapPaths)).toEqual([
      "curriculum/a",
      "curriculum/a-1",
      "curriculum/a/1",
      "curriculum/z",
      "curriculum/ä",
      "curriculum/\ue000",
      "curriculum/\u{10000}",
    ]);
  });
  it("keeps equal routes stable and shorter prefixes first in either direction", () => {
    const path = "curriculum/\u{10000}";
    expect(compareSitemapPaths(path, path)).toBe(0);
    expect(compareSitemapPaths(path, `${path}/lesson`)).toBeLessThan(0);
    expect(compareSitemapPaths(`${path}/lesson`, path)).toBeGreaterThan(0);
  });
});
