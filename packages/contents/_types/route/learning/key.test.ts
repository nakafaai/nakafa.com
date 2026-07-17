import { listPublicArticleRoutes } from "@repo/contents/_types/route/article";
import { readRouteLocaleIdentityKey } from "@repo/contents/_types/route/learning/key";
import { Effect } from "effect";
import { describe, expect, it } from "vitest";

describe("public route identity keys", () => {
  it("uses the article category as its source identity", () => {
    const route = Effect.runSync(listPublicArticleRoutes()).at(0);

    if (!route) {
      expect.fail("Expected an article category route.");
    }

    expect(readRouteLocaleIdentityKey(route, "id")).toBe(
      "article-category:politics:id"
    );
  });
});
