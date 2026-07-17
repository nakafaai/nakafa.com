import { api, internal } from "@repo/backend/convex/_generated/api";
import type { Doc } from "@repo/backend/convex/_generated/dataModel";
import { CONTENT_ROUTE_ARTIFACT_PAGE_SIZE } from "@repo/backend/convex/contents/constants";
import schema from "@repo/backend/convex/schema";
import { convexModules } from "@repo/backend/convex/test.setup";
import { createLearningGraphIdentityFromRoute } from "@repo/contents/_types/learning-graph";
import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";

const NOW = Date.parse("2026-01-02T00:00:00.000Z");

describe("contentSync/mutations/routes", () => {
  it("commits newer route-count generations even when the count is unchanged", async () => {
    const t = convexTest(schema, convexModules);
    const created = await syncCount(t, 2);
    const unchanged = await syncCount(t, 2);
    const generationUpdated = await syncCount(t, 2, NOW + 1);
    const countUpdated = await syncCount(t, 1, NOW + 2);
    const counts = await t.query(
      api.contents.queries.runtime.listContentRouteCounts,
      { locale: "id" }
    );

    expect(created).toEqual({ created: 1, unchanged: 0, updated: 0 });
    expect(unchanged).toEqual({ created: 0, unchanged: 1, updated: 0 });
    expect(generationUpdated).toEqual({
      created: 0,
      unchanged: 0,
      updated: 1,
    });
    expect(countUpdated).toEqual({ created: 0, unchanged: 0, updated: 1 });
    expect(counts).toEqual([
      expect.objectContaining({
        count: 1,
        locale: "id",
        section: "articles",
        syncedAt: NOW + 2,
      }),
    ]);
  });

  it("keeps the committed route generation visible until the pointer advances", async () => {
    const t = convexTest(schema, convexModules);
    const firstRoute = "articles/politics/first";
    const secondRoute = "articles/politics/second";

    const created = await syncPage(t, [contentRoutePageItem(firstRoute)]);
    const unchanged = await syncPage(t, [contentRoutePageItem(firstRoute)]);
    await syncCount(t, 1);
    const nextGeneration = await syncPage(
      t,
      [contentRoutePageItem(secondRoute)],
      0,
      NOW + 1
    );
    const committedPage = await t.query(
      api.contents.queries.runtime.getContentRouteArtifactPage,
      {
        locale: "id",
        page: 0,
        section: "articles",
      }
    );
    await syncCount(t, 1, NOW + 1);
    const nextPage = await t.query(
      api.contents.queries.runtime.getContentRouteArtifactPage,
      {
        locale: "id",
        page: 0,
        section: "articles",
      }
    );

    expect(created).toEqual({ created: 1, unchanged: 0, updated: 0 });
    expect(unchanged).toEqual({ created: 0, unchanged: 1, updated: 0 });
    expect(nextGeneration).toEqual({
      created: 1,
      unchanged: 0,
      updated: 0,
    });
    expect(committedPage?.routes.map((route) => route.route)).toEqual([
      firstRoute,
    ]);
    expect(nextPage?.routes.map((route) => route.route)).toEqual([secondRoute]);
  });

  it("rejects conflicting pages, counts, and stale generation commits", async () => {
    const t = convexTest(schema, convexModules);

    await syncPage(t, [contentRoutePageItem("articles/politics/first")]);

    await expect(
      syncPage(t, [contentRoutePageItem("articles/politics/second")])
    ).rejects.toThrow("CONTENT_ROUTE_ARTIFACT_GENERATION_CONFLICT");

    await syncCount(t, 1, NOW + 1);

    await expect(syncCount(t, 2, NOW + 1)).rejects.toThrow(
      "CONTENT_ROUTE_ARTIFACT_GENERATION_CONFLICT"
    );
    await expect(syncCount(t, 1)).rejects.toThrow(
      "CONTENT_ROUTE_ARTIFACT_GENERATION_STALE"
    );
  });

  it("rejects invalid route counts and generation timestamps", async () => {
    const t = convexTest(schema, convexModules);

    for (const invalidCount of [-1, 1.5]) {
      await expect(syncCount(t, invalidCount)).rejects.toThrow(
        "CONTENT_ROUTE_ARTIFACT_COUNT_INVALID"
      );
    }
    await expect(syncCount(t, 1, 0)).rejects.toThrow(
      "CONTENT_ROUTE_ARTIFACT_GENERATION_INVALID"
    );
    await expect(
      syncPage(t, [contentRoutePageItem("articles/politics/first")], 0, 0)
    ).rejects.toThrow("CONTENT_ROUTE_ARTIFACT_GENERATION_INVALID");
    await expect(
      syncPage(t, [contentRoutePageItem("articles/politics/first")], -1)
    ).rejects.toThrow("CONTENT_ROUTE_ARTIFACT_PAGE_INVALID");
  });

  it("rejects route artifact documents at or above the Convex size limit", async () => {
    const t = convexTest(schema, convexModules);
    const route = {
      ...contentRoutePageItem("articles/politics/oversized"),
      description: "x".repeat(1024 * 1024),
    };

    await expect(syncPage(t, [route])).rejects.toThrow(
      "CONTENT_ROUTE_ARTIFACT_DOCUMENT_SIZE_INVALID"
    );
  });

  it("rejects route artifact pages that exceed the public page size", async () => {
    const t = convexTest(schema, convexModules);
    const routes = Array.from(
      { length: CONTENT_ROUTE_ARTIFACT_PAGE_SIZE + 1 },
      (_, index) => contentRoutePageItem(`articles/politics/route-${index}`)
    );

    await expect(syncPage(t, routes)).rejects.toThrow(
      "CONTENT_ROUTE_ARTIFACT_PAGE_SIZE_INVALID"
    );
  });

  it("deletes route artifact pages older than the committed generation", async () => {
    const t = convexTest(schema, convexModules);

    await syncPage(t, [contentRoutePageItem("articles/politics/first")], 0);
    await syncPage(t, [contentRoutePageItem("articles/politics/second")], 1);
    await syncPage(t, [contentRoutePageItem("articles/politics/third")], 2);
    await syncPage(
      t,
      [contentRoutePageItem("articles/politics/current")],
      0,
      NOW + 1
    );
    await syncCount(t, 1, NOW + 1);

    const deleted = await t.mutation(
      internal.contentSync.mutations.routes
        .deleteStaleContentRouteArtifactPages,
      {
        committedSyncedAt: NOW + 1,
        locale: "id",
        section: "articles",
      }
    );
    const unchanged = await t.mutation(
      internal.contentSync.mutations.routes
        .deleteStaleContentRouteArtifactPages,
      {
        committedSyncedAt: NOW + 1,
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

    expect(deleted).toEqual({ deleted: 3 });
    expect(unchanged).toEqual({ deleted: 0 });
    expect(remaining?.routes.map((route) => route.route)).toEqual([
      "articles/politics/current",
    ]);
    expect(removed).toBeNull();
  });
});

/** Runs the internal route-count materialization mutation. */
function syncCount(
  t: ReturnType<typeof convexTest>,
  count: number,
  syncedAt = NOW
) {
  return t.mutation(
    internal.contentSync.mutations.routes.syncContentRouteArtifactCount,
    {
      count,
      locale: "id",
      section: "articles",
      syncedAt,
    }
  );
}

/** Runs the internal route-page materialization mutation. */
function syncPage(
  t: ReturnType<typeof convexTest>,
  routes: ReturnType<typeof contentRoutePageItem>[],
  page = 0,
  syncedAt = NOW
) {
  return t.mutation(
    internal.contentSync.mutations.routes.syncContentRouteArtifactPage,
    {
      locale: "id",
      page,
      routes,
      section: "articles",
      syncedAt,
    }
  );
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
