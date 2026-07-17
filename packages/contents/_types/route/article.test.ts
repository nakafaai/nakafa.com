import { listPublicArticleRoutes } from "@repo/contents/_types/route/article";
import { Effect } from "effect";
import { describe, expect, it } from "vitest";

describe("article public routes", () => {
  it("projects one localized durable route for every article category", () => {
    expect(Effect.runSync(listPublicArticleRoutes())).toEqual([
      {
        category: "politics",
        kind: "article-category",
        locale: "en",
        publicPath: "articles/politics",
        sitemap: true,
        title: "Politics",
      },
      {
        category: "politics",
        kind: "article-category",
        locale: "id",
        publicPath: "articles/politics",
        sitemap: true,
        title: "Politik",
      },
    ]);
  });
});
