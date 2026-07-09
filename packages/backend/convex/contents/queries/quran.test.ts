import { api, internal } from "@repo/backend/convex/_generated/api";
import { createConvexTestWithBetterAuth } from "@repo/backend/convex/test.helpers";
import { createLearningGraphIdentityFromRoute } from "@repo/contents/_types/learning-graph";
import { describe, expect, it } from "vitest";

describe("contents/queries/search:quran", () => {
  it("returns Quran rows written by the Quran search sync mutation", async () => {
    const t = createConvexTestWithBetterAuth();
    const route = "quran/1";
    const identity = createLearningGraphIdentityFromRoute({
      locale: "id",
      route,
    });

    if (!identity) {
      expect.fail(`Expected graph identity for ${route}.`);
    }

    const catalogGraph = {
      alignmentId: `${identity.alignmentId}:catalog`,
      assetId: `${identity.assetId}:catalog`,
      conceptId: `${identity.conceptId}:catalog`,
      learningObjectId: `${identity.learningObjectId}:catalog`,
      lensId: `${identity.lensId}:catalog`,
    };

    await t.mutation(async (ctx) => {
      await ctx.db.insert("contentRoutes", {
        ...catalogGraph,
        authors: [],
        contentHash: "route-hash-fatihah",
        content_id: catalogGraph.assetId,
        kind: "quran-surah",
        locale: "id",
        markdown: true,
        route,
        section: "quran",
        sourcePath: route,
        syncedAt: 1,
        title: "1. Al-Fatihah",
      });
      await ctx.db.insert("contentSearch", {
        ...identity,
        contentHash: "old-hash-fatihah",
        content_id: identity.assetId,
        description: "Old Pembukaan",
        locale: "id",
        markdown_url: `https://nakafa.com/id/${route}.md`,
        route,
        section: "quran",
        sourcePath: route,
        syncedAt: 1,
        text: "old stale search row",
        title: "Old Al-Fatihah",
        url: `https://nakafa.com/id/${route}`,
      });
    });

    const summary = await t.mutation(
      internal.contents.mutations.search.bulkSyncQuranSearch,
      {
        documents: [
          {
            contentHash: "hash-fatihah",
            description: "Pembukaan",
            locale: "id",
            route,
            text: "Al-Fatihah pembukaan rahmat petunjuk",
            title: "1. Al-Fatihah",
          },
        ],
      }
    );

    const result = await t.query(api.contents.queries.search.search, {
      limit: 10,
      locale: "id",
      offset: 0,
      queries: ["petunjuk"],
      section: "quran",
    });
    const rows = await t.query(
      async (ctx) =>
        await ctx.db
          .query("contentSearch")
          .withIndex("by_locale_and_route", (q) =>
            q.eq("locale", "id").eq("route", route)
          )
          .take(10)
    );

    expect(summary).toEqual({ created: 1, unchanged: 0, updated: 0 });
    expect(rows).toHaveLength(1);
    expect(rows[0]).toEqual(
      expect.objectContaining({
        ...catalogGraph,
        content_id: catalogGraph.assetId,
      })
    );
    expect(result.items).toEqual([
      expect.objectContaining({
        content_id: catalogGraph.assetId,
        section: "quran",
        title: "1. Al-Fatihah",
      }),
    ]);
  });

  it("rejects Quran search sync without a route graph projection", async () => {
    const t = createConvexTestWithBetterAuth();

    await expect(
      t.mutation(internal.contents.mutations.search.bulkSyncQuranSearch, {
        documents: [
          {
            contentHash: "hash-fatihah",
            description: "Pembukaan",
            locale: "id",
            route: "quran/1",
            text: "Al-Fatihah pembukaan rahmat petunjuk",
            title: "1. Al-Fatihah",
          },
        ],
      })
    ).rejects.toThrow("requires a persisted route graph projection");
  });
});
