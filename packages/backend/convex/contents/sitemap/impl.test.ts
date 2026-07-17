import { api } from "@repo/backend/convex/_generated/api";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import schema from "@repo/backend/convex/schema";
import { convexModules } from "@repo/backend/convex/test.setup";
import { createLearningGraphIdentityFromRoute } from "@repo/contents/_types/learning-graph";
import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";

describe("public sitemap runtime", () => {
  it("reads the second thousand-row content sitemap group directly", async () => {
    const t = convexTest(schema, convexModules);
    await t.mutation(seedSecondContentSitemapPage);

    const page = await t.query(
      api.contents.queries.runtime.getContentSitemapPage,
      { locale: "en", page: 1, section: "articles" }
    );

    expect(page?.routes.map((route) => route.route)).toEqual([
      "articles/fixture/final",
    ]);
  });

  it("reads a same-count rebuild with mixed artifact generations", async () => {
    const t = convexTest(schema, convexModules);
    await t.mutation(seedMixedGenerationContentSitemapPage);

    const page = await t.query(
      api.contents.queries.runtime.getContentSitemapPage,
      { locale: "en", page: 0, section: "articles" }
    );

    expect(page?.routes).toHaveLength(101);
    expect(page?.routes.at(0)).toMatchObject({
      route: "articles/fixture/page-0-route-0",
      syncedAt: 2,
    });
    expect(page?.routes.at(-1)).toMatchObject({
      route: "articles/fixture/page-1-route-0",
      syncedAt: 1,
    });
  });

  it("reads one exact indexed boundary page and excludes other route kinds", async () => {
    const t = convexTest(schema, convexModules);
    await t.mutation(seedSitemapPage);

    const count = await t.query(
      api.contents.queries.runtime.getPublicSitemapCount,
      { locale: "en" }
    );
    const page = await t.query(
      api.contents.queries.runtime.getPublicSitemapPage,
      {
        locale: "en",
        page: 0,
      }
    );

    expect(count).toEqual({ count: 2, pageCount: 1 });
    expect(page).toEqual({
      paths: ["curriculum/fixture/a", "curriculum/fixture/c"],
      syncedAt: 1,
    });
  });

  it("fails loudly when persisted boundaries do not match route rows", async () => {
    const t = convexTest(schema, convexModules);
    await t.mutation(seedSitemapPage);
    await t.mutation(async (ctx) => {
      const page = await ctx.db
        .query("publicRouteSitemapPages")
        .withIndex("by_locale_and_page", (query) =>
          query.eq("locale", "en").eq("page", 0)
        )
        .unique();

      if (page) {
        await ctx.db.patch(page._id, { routeCount: 3 });
      }
    });

    await expect(
      t.query(api.contents.queries.runtime.getPublicSitemapPage, {
        locale: "en",
        page: 0,
      })
    ).rejects.toMatchObject({
      data: { code: "PUBLIC_SITEMAP_PAGE_INTEGRITY" },
    });
  });

  it("reads valid boundaries independently of their last-change timestamp", async () => {
    const t = convexTest(schema, convexModules);
    await t.mutation(seedSitemapPage);
    await t.mutation(async (ctx) => {
      const page = await ctx.db
        .query("publicRouteSitemapPages")
        .withIndex("by_locale_and_page", (query) =>
          query.eq("locale", "en").eq("page", 0)
        )
        .unique();

      if (page) {
        await ctx.db.patch(page._id, { syncedAt: 2 });
      }
    });

    const page = await t.query(
      api.contents.queries.runtime.getPublicSitemapPage,
      { locale: "en", page: 0 }
    );

    expect(page).toEqual({
      paths: ["curriculum/fixture/a", "curriculum/fixture/c"],
      syncedAt: 2,
    });
  });
});

/** Seeds artifact page 10, the first page in content sitemap group two. */
async function seedSecondContentSitemapPage(ctx: MutationCtx) {
  const route = "articles/fixture/final";

  await ctx.db.insert("contentRouteCounts", {
    count: 1001,
    locale: "en",
    section: "articles",
    syncedAt: 1,
  });
  await ctx.db.insert("contentRoutePages", {
    locale: "en",
    page: 10,
    routeCount: 1,
    routes: [contentRoutePageItem(route, 1)],
    section: "articles",
    syncedAt: 1,
  });
}

/** Seeds two artifact pages where only the rebuilt page has a new timestamp. */
async function seedMixedGenerationContentSitemapPage(ctx: MutationCtx) {
  const firstPageRoutes = Array.from({ length: 100 }, (_, index) =>
    contentRoutePageItem(`articles/fixture/page-0-route-${index}`, 1)
  );
  firstPageRoutes[0] = contentRoutePageItem(
    "articles/fixture/page-0-route-0",
    2
  );

  await ctx.db.insert("contentRouteCounts", {
    count: 101,
    locale: "en",
    section: "articles",
    syncedAt: 1,
  });
  await ctx.db.insert("contentRoutePages", {
    locale: "en",
    page: 0,
    routeCount: 100,
    routes: firstPageRoutes,
    section: "articles",
    syncedAt: 2,
  });
  await ctx.db.insert("contentRoutePages", {
    locale: "en",
    page: 1,
    routeCount: 1,
    routes: [contentRoutePageItem("articles/fixture/page-1-route-0", 1)],
    section: "articles",
    syncedAt: 1,
  });
}

/** Builds one stored route item for content sitemap artifact fixtures. */
function contentRoutePageItem(route: string, syncedAt: number) {
  const graph = createLearningGraphIdentityFromRoute({ locale: "en", route });

  if (!graph) {
    throw new Error("Expected a graph identity for the content route fixture.");
  }

  return {
    ...graph,
    authors: [{ name: "Nakafa" }],
    content_id: graph.assetId,
    date: 1,
    kind: "article" as const,
    locale: "en" as const,
    markdown: true,
    route,
    section: "articles" as const,
    sourcePath: route,
    syncedAt,
    title: route,
  };
}

/** Seeds one page plus unrelated rows that the compound index must exclude. */
async function seedSitemapPage(ctx: MutationCtx) {
  await ctx.db.insert("publicRouteSitemapCounts", {
    count: 2,
    hash: "count-hash",
    locale: "en",
    pageCount: 1,
    syncedAt: 1,
  });
  await ctx.db.insert("publicRouteSitemapPages", {
    endPath: "curriculum/fixture/c",
    hash: "page-hash",
    locale: "en",
    page: 0,
    routeCount: 2,
    startPath: "curriculum/fixture/a",
    syncedAt: 1,
  });
  await insertPublicRoute(ctx, "curriculum/fixture/a", "curriculum-context");
  await insertPublicRoute(ctx, "curriculum/fixture/b", "subject-topic");
  await insertPublicRoute(ctx, "curriculum/fixture/c", "curriculum-context");
}

/** Inserts one minimal stored route for compound-index behavior tests. */
async function insertPublicRoute(
  ctx: MutationCtx,
  publicPath: string,
  kind: "curriculum-context" | "subject-topic"
) {
  await ctx.db.insert("publicRoutes", {
    contentHash: `hash-${publicPath}`,
    kind,
    locale: "en",
    publicPath,
    sitemap: true,
    syncShard: 1,
    title: publicPath,
  });
}
