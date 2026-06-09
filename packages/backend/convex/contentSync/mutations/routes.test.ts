import { api, internal } from "@repo/backend/convex/_generated/api";
import type { Doc } from "@repo/backend/convex/_generated/dataModel";
import { CONTENT_ROUTE_ARTIFACT_PAGE_SIZE } from "@repo/backend/convex/contents/constants";
import schema from "@repo/backend/convex/schema";
import { convexModules } from "@repo/backend/convex/test.setup";
import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";

const NOW = Date.parse("2026-01-02T00:00:00.000Z");

describe("contentSync/mutations/routes", () => {
  it("creates, updates, and preserves materialized route count rows", async () => {
    const t = convexTest(schema, convexModules);
    const firstRoute = "articles/politics/first";
    const secondRoute = "articles/politics/second";

    await t.mutation(async (ctx) => {
      await ctx.db.insert("contentRoutes", contentRoute(firstRoute));
      await ctx.db.insert("contentRoutes", contentRoute(secondRoute));
    });

    const created = await syncCount(t, 2);
    const unchanged = await syncCount(t, 2);
    const updated = await syncCount(t, 1);
    const legacyRows = await t.query(
      async (ctx) =>
        await ctx.db
          .query("contentRoutes")
          .withIndex("by_locale_and_section", (q) =>
            q.eq("locale", "id").eq("section", "articles")
          )
          .collect()
    );
    const counts = await t.query(
      api.contents.queries.runtime.listContentRouteCounts,
      { locale: "id" }
    );

    expect(created).toEqual({ created: 1, unchanged: 0, updated: 0 });
    expect(unchanged).toEqual({ created: 0, unchanged: 1, updated: 0 });
    expect(updated).toEqual({ created: 0, unchanged: 0, updated: 1 });
    expect(legacyRows.every((row) => row.countedAt === undefined)).toBe(true);
    expect(counts).toEqual([
      expect.objectContaining({
        count: 1,
        locale: "id",
        section: "articles",
      }),
    ]);
  });

  it("creates, preserves, and updates bounded route artifact pages", async () => {
    const t = convexTest(schema, convexModules);
    const firstRoute = "articles/politics/first";
    const secondRoute = "articles/politics/second";

    const created = await syncPage(t, [contentRoutePageItem(firstRoute)]);
    const unchanged = await syncPage(t, [contentRoutePageItem(firstRoute)]);
    const routeUpdated = await syncPage(t, [contentRoutePageItem(secondRoute)]);
    const countUpdated = await syncPage(t, [
      contentRoutePageItem(firstRoute),
      contentRoutePageItem(secondRoute),
    ]);
    const page = await t.query(
      api.contents.queries.runtime.getContentRouteArtifactPage,
      {
        locale: "id",
        page: 0,
        section: "articles",
      }
    );

    expect(created).toEqual({ created: 1, unchanged: 0, updated: 0 });
    expect(unchanged).toEqual({ created: 0, unchanged: 1, updated: 0 });
    expect(routeUpdated).toEqual({ created: 0, unchanged: 0, updated: 1 });
    expect(countUpdated).toEqual({ created: 0, unchanged: 0, updated: 1 });
    expect(page?.routes.map((route) => route.route)).toEqual([
      firstRoute,
      secondRoute,
    ]);
  });

  it("rejects route artifact pages that exceed the public page size", async () => {
    const t = convexTest(schema, convexModules);
    const routes = Array.from(
      { length: CONTENT_ROUTE_ARTIFACT_PAGE_SIZE + 1 },
      (_, index) => contentRoutePageItem(`articles/politics/route-${index}`)
    );

    await expect(syncPage(t, routes)).rejects.toThrow(
      "CONTENT_ROUTE_ARTIFACT_PAGE_TOO_LARGE"
    );
  });

  it("deletes stale route artifact pages after the current page range", async () => {
    const t = convexTest(schema, convexModules);

    await syncPage(t, [contentRoutePageItem("articles/politics/first")], 0);
    await syncPage(t, [contentRoutePageItem("articles/politics/second")], 1);
    await syncPage(t, [contentRoutePageItem("articles/politics/third")], 2);

    const deleted = await t.mutation(
      internal.contentSync.mutations.routes
        .deleteStaleContentRouteArtifactPages,
      {
        firstStalePage: 1,
        locale: "id",
        section: "articles",
      }
    );
    const unchanged = await t.mutation(
      internal.contentSync.mutations.routes
        .deleteStaleContentRouteArtifactPages,
      {
        firstStalePage: 1,
        locale: "id",
        section: "articles",
      }
    );
    const remaining = await t.query(
      api.contents.queries.runtime.getContentRouteArtifactPage,
      {
        locale: "id",
        page: 0,
        section: "articles",
      }
    );
    const removed = await t.query(
      api.contents.queries.runtime.getContentRouteArtifactPage,
      {
        locale: "id",
        page: 1,
        section: "articles",
      }
    );

    expect(deleted).toEqual({ deleted: 2 });
    expect(unchanged).toEqual({ deleted: 0 });
    expect(remaining?.routes.map((route) => route.route)).toEqual([
      "articles/politics/first",
    ]);
    expect(removed).toBeNull();
  });
});

/** Runs the internal route-count materialization mutation. */
function syncCount(t: ReturnType<typeof convexTest>, count: number) {
  return t.mutation(
    internal.contentSync.mutations.routes.syncContentRouteArtifactCount,
    {
      count,
      locale: "id",
      section: "articles",
      syncedAt: NOW,
    }
  );
}

/** Runs the internal route-page materialization mutation. */
function syncPage(
  t: ReturnType<typeof convexTest>,
  routes: ReturnType<typeof contentRoutePageItem>[],
  page = 0
) {
  return t.mutation(
    internal.contentSync.mutations.routes.syncContentRouteArtifactPage,
    {
      locale: "id",
      page,
      routes,
      section: "articles",
      syncedAt: NOW,
    }
  );
}

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
function contentRoutePageItem(
  route: string
): Doc<"contentRoutePages">["routes"][number] {
  return {
    authors: [{ name: "Nakafa Author" }],
    content_id: `id/${route}`,
    date: NOW,
    kind: "article",
    locale: "id",
    markdown: true,
    route,
    section: "articles",
    syncedAt: NOW,
    title: route,
  };
}
