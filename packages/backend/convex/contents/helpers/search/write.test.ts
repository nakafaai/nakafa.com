import {
  buildContentSearchDocument,
  type ContentSearchSource,
} from "@repo/backend/convex/contents/helpers/search/documents";
import { syncContentSearch } from "@repo/backend/convex/contents/helpers/search/write";
import schema from "@repo/backend/convex/schema";
import { convexModules } from "@repo/backend/convex/test.setup";
import { createLearningGraphIdentityFromRoute } from "@repo/contents/_types/learning-graph";
import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";

const NOW = Date.parse("2026-01-02T00:00:00.000Z");

describe("syncContentSearch", () => {
  it("updates a detached route-indexed row instead of inserting a duplicate", async () => {
    const t = convexTest(schema, convexModules);
    const route = "articles/politics/detached-search";
    const source = contentSearchSource(route);

    await t.mutation(async (ctx) => {
      await ctx.db.insert(
        "contentSearch",
        detachedContentSearchDocument(route)
      );
    });

    const result = await t.mutation(
      async (ctx) => await syncContentSearch(ctx, source)
    );
    const rows = await t.query(
      async (ctx) =>
        await ctx.db
          .query("contentSearch")
          .withIndex("by_locale_and_route", (q) =>
            q.eq("locale", "id").eq("route", route)
          )
          .collect()
    );

    expect(result).toBe("updated");
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      assetId: source.assetId,
      content_id: source.assetId,
      route,
    });
  });
});

/** Builds one canonical search source fixture from graph identity. */
function contentSearchSource(route: string): ContentSearchSource {
  const identity = createLearningGraphIdentityFromRoute({
    locale: "id",
    route,
  });

  if (!identity) {
    throw new Error(`Expected article graph identity for ${route}.`);
  }

  return {
    ...identity,
    contentHash: `${route}:hash`,
    description: "Fixture description",
    locale: "id",
    route,
    section: "articles",
    sourcePath: route,
    syncedAt: NOW,
    text: "Fixture body",
    title: "Fixture title",
  };
}

/** Builds one stale route-indexed row with detached catalog identity. */
function detachedContentSearchDocument(route: string) {
  return {
    ...buildContentSearchDocument(contentSearchSource(route)),
    alignmentId: `alignment:detached:${route}`,
    assetId: `asset:detached:${route}`,
    conceptId: `concept:detached:${route}`,
    content_id: `asset:detached:${route}`,
    learningObjectId: `lo:detached:${route}`,
    lensId: `lens:detached:${route}`,
  };
}
