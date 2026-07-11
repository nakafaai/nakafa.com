import { api, internal } from "@repo/backend/convex/_generated/api";
import type { Doc } from "@repo/backend/convex/_generated/dataModel";
import { deleteContentProjectionsBySourcePath } from "@repo/backend/convex/contentSync/lib/syncHelpers";
import { CONTENT_ROUTE_ARTIFACT_PAGE_SIZE } from "@repo/backend/convex/contents/constants";
import { syncContentRoute } from "@repo/backend/convex/contents/helpers/routes/write";
import {
  buildContentSearchDocument,
  type ContentSearchSource,
} from "@repo/backend/convex/contents/helpers/search/documents";
import schema from "@repo/backend/convex/schema";
import { convexModules } from "@repo/backend/convex/test.setup";
import { getSourceRouteProjectionForRoute } from "@repo/contents/_types/graph/projection";
import { createLearningGraphIdentityFromRoute } from "@repo/contents/_types/learning-graph";
import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";

const NOW = Date.parse("2026-01-02T00:00:00.000Z");

describe("contentSync/mutations/routes", () => {
  it("uses the graph source-route projection spec for parent routes", async () => {
    const t = convexTest(schema, convexModules);
    const routes = [
      "quran/1",
      "material/lesson/chemistry/atomic-structure",
      "material/lesson/chemistry/atomic-structure/electron-configuration",
      "try-out/indonesia/snbt",
      "try-out/indonesia/snbt/2027",
      "try-out/indonesia/snbt/2027/set-1",
      "try-out/indonesia/snbt/2027/set-1/pengetahuan-kuantitatif",
    ];

    await t.mutation(async (ctx) => {
      for (const route of routes) {
        await syncContentRoute(ctx, contentRouteFromProjection(route));
      }
    });

    const rows = await t.query(async (ctx) => {
      const storedRows: Array<Doc<"contentRoutes"> | null> = [];

      for (const route of routes) {
        const row = await ctx.db
          .query("contentRoutes")
          .withIndex("by_locale_and_sourcePath", (q) =>
            q.eq("locale", "id").eq("sourcePath", route)
          )
          .unique();

        storedRows.push(row);
      }

      return storedRows;
    });

    expect(rows).toEqual([
      expect.objectContaining({
        sourceParentPath: "quran",
        sourcePath: "quran/1",
      }),
      expect.objectContaining({
        sourceParentPath: "material/lesson/chemistry",
        sourcePath: "material/lesson/chemistry/atomic-structure",
      }),
      expect.objectContaining({
        sourceParentPath: "material/lesson/chemistry/atomic-structure",
        sourcePath:
          "material/lesson/chemistry/atomic-structure/electron-configuration",
      }),
      expect.objectContaining({
        sourceParentPath: "try-out/indonesia",
        sourcePath: "try-out/indonesia/snbt",
      }),
      expect.objectContaining({
        sourceParentPath: "try-out/indonesia/snbt",
        sourcePath: "try-out/indonesia/snbt/2027",
      }),
      expect.objectContaining({
        sourceParentPath: "try-out/indonesia/snbt/2027",
        sourcePath: "try-out/indonesia/snbt/2027/set-1",
      }),
      expect.objectContaining({
        sourceParentPath: "try-out/indonesia/snbt/2027/set-1",
        sourcePath:
          "try-out/indonesia/snbt/2027/set-1/pengetahuan-kuantitatif",
      }),
    ]);
  });

  it("updates a detached route-indexed row instead of inserting a duplicate", async () => {
    const t = convexTest(schema, convexModules);
    const route = "articles/politics/detached";
    const source = contentRouteSource(route);

    await t.mutation(async (ctx) => {
      await ctx.db.insert("contentRoutes", {
        ...detachedContentRoute(route),
        countedAt: NOW,
      });
      await ctx.db.insert("contentRouteCounts", {
        count: 1,
        locale: "id",
        section: "articles",
        syncedAt: NOW,
      });
    });

    const result = await t.mutation(
      async (ctx) => await syncContentRoute(ctx, source)
    );
    const rows = await t.query(
      async (ctx) =>
        await ctx.db
          .query("contentRoutes")
          .withIndex("by_locale_and_route", (q) =>
            q.eq("locale", "id").eq("route", route)
          )
          .collect()
    );
    const counts = await t.query(
      api.contents.queries.runtime.listContentRouteCounts,
      { locale: "id" }
    );

    expect(result).toBe("updated");
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      assetId: source.assetId,
      content_id: source.assetId,
      route,
    });
    expect(counts).toEqual([
      expect.objectContaining({
        count: 1,
        locale: "id",
        section: "articles",
      }),
    ]);
  });

  it("deletes duplicate route and search projections by public route", async () => {
    const t = convexTest(schema, convexModules);
    const route = "articles/politics/stale-duplicate";

    await t.mutation(async (ctx) => {
      await ctx.db.insert("contentRoutes", {
        ...contentRoute(route),
        countedAt: NOW,
      });
      await ctx.db.insert("contentRoutes", {
        ...detachedContentRoute(route),
        countedAt: NOW,
      });
      await ctx.db.insert(
        "contentSearch",
        buildContentSearchDocument(contentSearchSource(route))
      );
      await ctx.db.insert(
        "contentSearch",
        detachedContentSearchDocument(route)
      );
      await ctx.db.insert("contentRouteCounts", {
        count: 2,
        locale: "id",
        section: "articles",
        syncedAt: NOW,
      });

      await deleteContentProjectionsBySourcePath(ctx, {
        locale: "id",
        route,
      });
    });

    const snapshot = await t.query(async (ctx) => {
      const routeRows = await ctx.db
        .query("contentRoutes")
        .withIndex("by_locale_and_route", (q) =>
          q.eq("locale", "id").eq("route", route)
        )
        .collect();
      const searchRows = await ctx.db
        .query("contentSearch")
        .withIndex("by_locale_and_route", (q) =>
          q.eq("locale", "id").eq("route", route)
        )
        .collect();
      const counts = await ctx.db
        .query("contentRouteCounts")
        .withIndex("by_locale_and_section", (q) =>
          q.eq("locale", "id").eq("section", "articles")
        )
        .collect();

      return { counts, routeRows, searchRows };
    });

    expect(snapshot.routeRows).toHaveLength(0);
    expect(snapshot.searchRows).toHaveLength(0);
    expect(snapshot.counts).toEqual([
      expect.objectContaining({
        count: 0,
        locale: "id",
        section: "articles",
      }),
    ]);
  });

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
    const uncountedRows = await t.query(
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
    expect(uncountedRows.every((row) => row.countedAt === undefined)).toBe(
      true
    );
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

/** Builds one uncounted route row that predates count materialization. */
function contentRoute(route: string) {
  const graph = articleRouteGraph(route);

  return {
    ...graph,
    authors: [{ name: "Nakafa Author" }],
    contentHash: `${route}:hash`,
    date: NOW,
    kind: "article" as const,
    locale: "id" as const,
    markdown: true,
    route,
    section: "articles" as const,
    sourcePath: route,
    syncedAt: NOW,
    title: route,
  };
}

/** Builds one source row used by the route sync mutation. */
function contentRouteSource(route: string) {
  return {
    ...contentRoute(route),
    publicPath: route,
  };
}

/** Builds one route row from the shared graph source-route projection spec. */
function contentRouteFromProjection(route: string) {
  const projection = getSourceRouteProjectionForRoute(route, "id");

  if (!projection) {
    throw new Error(`Expected graph source-route projection for ${route}.`);
  }

  const graph = createLearningGraphIdentityFromRoute({
    locale: "id",
    route,
  });

  if (!graph) {
    throw new Error(`Expected graph identity fixture for ${route}.`);
  }

  return {
    ...graph,
    authors: [{ name: "Nakafa Author" }],
    contentHash: `${route}:hash`,
    content_id: graph.assetId,
    date: NOW,
    kind: projection.kind,
    locale: "id" as const,
    markdown: true,
    publicPath: route,
    section: projection.sourceRoot,
    sourcePath: route,
    syncedAt: NOW,
    title: route,
  };
}

/** Builds an already-counted route row with catalog-owned graph identity. */
function detachedContentRoute(route: string) {
  return {
    ...contentRoute(route),
    alignmentId: `alignment:detached:${route}`,
    assetId: `asset:detached:${route}`,
    conceptId: `concept:detached:${route}`,
    content_id: `asset:detached:${route}`,
    learningObjectId: `lo:detached:${route}`,
    lensId: `lens:detached:${route}`,
  };
}

/** Builds one canonical search source fixture from graph identity. */
function contentSearchSource(route: string): ContentSearchSource {
  const graph = articleRouteGraph(route);

  return {
    ...graph,
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

/** Builds one stale search row with detached graph identity. */
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

/** Builds one materialized route artifact fixture item. */
function contentRoutePageItem(
  route: string
): Doc<"contentRoutePages">["routes"][number] {
  const graph = articleRouteGraph(route);

  return {
    ...graph,
    authors: [{ name: "Nakafa Author" }],
    date: NOW,
    kind: "article",
    locale: "id",
    markdown: true,
    route,
    section: "articles",
    sourcePath: route,
    syncedAt: NOW,
    title: route,
  };
}

/** Builds graph identity fields for an article route fixture. */
function articleRouteGraph(route: string) {
  const identity = createLearningGraphIdentityFromRoute({
    locale: "id",
    route,
  });

  if (!identity) {
    throw new Error(`Expected article graph identity for ${route}.`);
  }

  return {
    ...identity,
    content_id: identity.assetId,
  };
}
