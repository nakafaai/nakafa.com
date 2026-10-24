import { describe, expect, it } from "@effect/vitest";
import { planSearchQueries } from "@repo/backend/confect/nina/research/query";

describe("search query planning", () => {
  it("runs the queries the model wrote as written, in order, without repeats, up to the limit", () => {
    expect(
      planSearchQueries({
        maxQueries: 3,
        queries: [
          "  React 19 Server Components  ",
          "   ",
          "REACT 19 SERVER COMPONENTS",
          "Cache Components 移行ガイド",
          "react.dev blog react-19",
          "React 19 リリースノート",
        ],
      })
    ).toEqual([
      "React 19 Server Components",
      "Cache Components 移行ガイド",
      "react.dev blog react-19",
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
