import { describe, expect, it } from "@effect/vitest";
import { articleNextTarget } from "@/lib/routing/public/article";

const search = { cursor: "c1", manifest: "m1", release: "r1" };

describe("article catalog continuation", () => {
  it("continues a category catalog on the category page with its cursor", () => {
    expect(articleNextTarget({ category: "politics", search })).toEqual(
      expect.objectContaining({
        params: { category: "politics" },
        search,
        to: "/$locale/articles/$category",
      })
    );
  });

  it("continues the article index when the catalog has no category", () => {
    expect(articleNextTarget({ search })).toEqual(
      expect.objectContaining({ search, to: "/$locale/articles" })
    );
  });
});
