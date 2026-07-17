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
  it("rejects a public route owned by another content identity", async () => {
    const t = convexTest(schema, convexModules);
    const route = "articles/politics/route-collision";
    const source = contentSearchSource(route);

    await t.mutation(async (ctx) => {
      await ctx.db.insert(
        "contentSearch",
        conflictingContentSearchDocument(route)
      );
    });

    await expect(
      t.mutation(async (ctx) => await syncContentSearch(ctx, source))
    ).rejects.toThrow("CONTENT_SEARCH_PUBLIC_PATH_COLLISION");
    const rows = await t.query(
      async (ctx) =>
        await ctx.db
          .query("contentSearch")
          .withIndex("by_locale_and_route", (q) =>
            q.eq("locale", "id").eq("route", route)
          )
          .collect()
    );

    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      assetId: `asset:conflict:${route}`,
      content_id: `asset:conflict:${route}`,
      route,
    });
  });

  it("rejects a source path owned by another content identity", async () => {
    const t = convexTest(schema, convexModules);
    const sourcePath = "articles/politics/source-collision";
    const existingRoute = "articles/politics/existing-search";

    await t.mutation(async (ctx) => {
      await ctx.db.insert("contentSearch", {
        ...conflictingContentSearchDocument(existingRoute),
        sourcePath,
      });
    });

    await expect(
      t.mutation(async (ctx) =>
        syncContentSearch(ctx, contentSearchSource(sourcePath))
      )
    ).rejects.toThrow("CONTENT_SEARCH_SOURCE_COLLISION");
    const rows = await t.query(
      async (ctx) =>
        await ctx.db
          .query("contentSearch")
          .withIndex("by_locale_and_sourcePath", (q) =>
            q.eq("locale", "id").eq("sourcePath", sourcePath)
          )
          .collect()
    );

    expect(rows).toHaveLength(1);
    expect(rows[0]?.route).toBe(existingRoute);
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

/** Builds one conflicting route-indexed row with another catalog identity. */
function conflictingContentSearchDocument(route: string) {
  return {
    ...buildContentSearchDocument(contentSearchSource(route)),
    alignmentId: `alignment:conflict:${route}`,
    assetId: `asset:conflict:${route}`,
    conceptId: `concept:conflict:${route}`,
    content_id: `asset:conflict:${route}`,
    learningObjectId: `lo:conflict:${route}`,
    lensId: `lens:conflict:${route}`,
  };
}
