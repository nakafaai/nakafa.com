import { describe, expect, it } from "@effect/vitest";
import { planSearchQueries } from "@repo/backend/confect/nina/research/query";

describe("search query planning", () => {
  it("runs the queries the model wrote as written, in order, without repeats, up to the limit", () => {
    expect(
      planSearchQueries({
        maxQueries: 3,
        queries: [
          "  Next.js 16 Cache Components  ",
          "   ",
          "NEXT.JS 16 CACHE COMPONENTS",
          "Cache Components 移行ガイド",
          "nextjs.org blog next-16",
          "Next.js 16 リリースノート",
        ],
      })
    ).toEqual([
      "Next.js 16 Cache Components",
      "Cache Components 移行ガイド",
      "nextjs.org blog next-16",
    ]);
  });

  it("collapses every run of spaces, tabs and line breaks inside a query", () => {
    expect(
      planSearchQueries({
        maxQueries: 4,
        queries: ["fungsi   kuadrat\tkelas\n10"],
      })
    ).toEqual(["fungsi kuadrat kelas 10"]);
  });
});
