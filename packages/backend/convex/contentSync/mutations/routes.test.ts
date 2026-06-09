import { api, internal } from "@repo/backend/convex/_generated/api";
import schema from "@repo/backend/convex/schema";
import { convexModules } from "@repo/backend/convex/test.setup";
import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";

const NOW = Date.parse("2026-01-02T00:00:00.000Z");

describe("contentSync/mutations/routes", () => {
  it("materializes route counts from rebuilt pages for uncounted route rows", async () => {
    const t = convexTest(schema, convexModules);
    const firstRoute = "articles/politics/first";
    const secondRoute = "articles/politics/second";

    await t.mutation(async (ctx) => {
      await ctx.db.insert("contentRoutes", contentRoute(firstRoute));
      await ctx.db.insert("contentRoutes", contentRoute(secondRoute));
    });
    await t.mutation(
      internal.contentSync.mutations.routes.syncContentRouteArtifactPage,
      {
        locale: "id",
        page: 0,
        routes: [
          contentRoutePageItem(firstRoute),
          contentRoutePageItem(secondRoute),
        ],
        section: "articles",
        syncedAt: NOW,
      }
    );
    await t.mutation(
      internal.contentSync.mutations.routes.syncContentRouteArtifactCount,
      {
        count: 2,
        locale: "id",
        section: "articles",
        syncedAt: NOW,
      }
    );

    const counts = await t.query(
      api.contents.queries.runtime.listContentRouteCounts,
      { locale: "id" }
    );
    const page = await t.query(
      api.contents.queries.runtime.getContentRouteArtifactPage,
      {
        locale: "id",
        page: 0,
        section: "articles",
      }
    );
    const legacyRows = await t.query(
      async (ctx) =>
        await ctx.db
          .query("contentRoutes")
          .withIndex("by_locale_and_section", (q) =>
            q.eq("locale", "id").eq("section", "articles")
          )
          .collect()
    );

    expect(legacyRows.every((row) => row.countedAt === undefined)).toBe(true);
    expect(counts).toEqual([
      expect.objectContaining({
        count: 2,
        locale: "id",
        section: "articles",
      }),
    ]);
    expect(page?.routes.map((route) => route.route)).toEqual([
      firstRoute,
      secondRoute,
    ]);
  });
});

/** Builds one legacy route row that predates countedAt backfills. */
function contentRoute(route: string) {
  return {
    authors: [{ name: "Nakafa Author" }],
    contentHash: `${route}:hash`,
    content_id: `id/${route}`,
    date: NOW,
    kind: "article" as const,
    locale: "id" as const,
    markdown: true,
    route,
    section: "articles" as const,
    syncedAt: NOW,
    title: route,
  };
}

/** Builds one materialized route artifact fixture item. */
function contentRoutePageItem(route: string) {
  return {
    authors: [{ name: "Nakafa Author" }],
    content_id: `id/${route}`,
    date: NOW,
    kind: "article" as const,
    locale: "id" as const,
    markdown: true,
    route,
    section: "articles" as const,
    syncedAt: NOW,
    title: route,
  };
}
