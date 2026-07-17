import { api } from "@repo/backend/convex/_generated/api";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import schema from "@repo/backend/convex/schema";
import { convexModules } from "@repo/backend/convex/test.setup";
import { createLearningGraphIdentityFromRoute } from "@repo/contents/_types/learning-graph";
import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";

const CONTENT_PAGE_ARGS = {
  locale: "en",
  page: 0,
  section: "articles",
} as const;
const PUBLIC_PAGE_ARGS = { locale: "en", page: 0 } as const;

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

  it("reads one complete generation before and after the count pointer flips", async () => {
    const t = convexTest(schema, convexModules);
    await t.mutation(seedContentSitemapGenerations);
    const committedPage = await t.query(
      api.contents.queries.runtime.getContentSitemapPage,
      CONTENT_PAGE_ARGS
    );
    await t.mutation(async (ctx) => {
      const count = await ctx.db
        .query("contentRouteCounts")
        .withIndex("by_locale_and_section", (query) =>
          query.eq("locale", "en").eq("section", "articles")
        )
        .unique();
      if (count) {
        await ctx.db.patch(count._id, { syncedAt: 2 });
      }
    });
    const nextPage = await t.query(
      api.contents.queries.runtime.getContentSitemapPage,
      CONTENT_PAGE_ARGS
    );
    expect(committedPage?.routes).toHaveLength(101);
    expect(committedPage?.routes.at(0)).toMatchObject({
      route: "articles/fixture/old-page-0-route-0",
      syncedAt: 1,
    });
    expect(committedPage?.routes.at(-1)).toMatchObject({
      route: "articles/fixture/old-page-1-route-0",
      syncedAt: 1,
    });
    expect(nextPage?.routes).toHaveLength(101);
    expect(nextPage?.routes.at(0)).toMatchObject({
      route: "articles/fixture/new-page-0-route-0",
      syncedAt: 2,
    });
    expect(nextPage?.routes.at(-1)).toMatchObject({
      route: "articles/fixture/new-page-1-route-0",
      syncedAt: 2,
    });
  });

  it.each([
    [-1, 1],
    [0, 0],
  ])("rejects invalid content count metadata", async (count, syncedAt) => {
    const t = convexTest(schema, convexModules);
    await t.mutation(async (ctx) => {
      await ctx.db.insert("contentRouteCounts", {
        count,
        locale: "en",
        section: "articles",
        syncedAt,
      });
    });
    await expect(
      t.query(
        api.contents.queries.runtime.getContentSitemapPage,
        CONTENT_PAGE_ARGS
      )
    ).rejects.toMatchObject({
      data: { code: "CONTENT_SITEMAP_PAGE_INTEGRITY" },
    });
  });

  it("reads exact paths only from the committed generation", async () => {
    const t = convexTest(schema, convexModules);
    await t.mutation(seedSitemapPage);
    const count = await t.query(
      api.contents.queries.runtime.getPublicSitemapCount,
      { locale: "en" }
    );
    const page = await t.query(
      api.contents.queries.runtime.getPublicSitemapPage,
      PUBLIC_PAGE_ARGS
    );
    expect(count).toEqual({ count: 2, pageCount: 1 });
    expect(page).toEqual({
      paths: ["curriculum/fixture/a", "curriculum/fixture/c"],
      syncedAt: 2,
    });
  });

  it("fails loudly when a committed page has the wrong path count", async () => {
    const t = convexTest(schema, convexModules);
    await t.mutation(seedSitemapPage);
    await t.mutation(async (ctx) => {
      const page = await getCommittedSitemapPage(ctx);
      if (page) {
        await ctx.db.patch(page._id, {
          paths: [
            "curriculum/fixture/a",
            "curriculum/fixture/b",
            "curriculum/fixture/c",
          ],
        });
      }
    });
    await expect(
      t.query(
        api.contents.queries.runtime.getPublicSitemapPage,
        PUBLIC_PAGE_ARGS
      )
    ).rejects.toMatchObject({
      data: { code: "PUBLIC_SITEMAP_PAGE_OVERFLOW" },
    });
  });

  it("rejects unsorted paths within the committed generation", async () => {
    const t = convexTest(schema, convexModules);
    await t.mutation(seedSitemapPage);
    await t.mutation(async (ctx) => {
      const page = await getCommittedSitemapPage(ctx);
      if (page) {
        await ctx.db.patch(page._id, {
          paths: ["curriculum/fixture/c", "curriculum/fixture/a"],
        });
      }
    });
    await expect(
      t.query(
        api.contents.queries.runtime.getPublicSitemapPage,
        PUBLIC_PAGE_ARGS
      )
    ).rejects.toMatchObject({
      data: { code: "PUBLIC_SITEMAP_PAGE_INTEGRITY" },
    });
  });

  it("fails when the committed generation page is missing", async () => {
    const t = convexTest(schema, convexModules);
    await t.mutation(seedSitemapPage);
    await t.mutation(async (ctx) => {
      const page = await getCommittedSitemapPage(ctx);
      if (page) {
        await ctx.db.delete("publicRouteSitemapPages", page._id);
      }
    });
    await expect(
      t.query(
        api.contents.queries.runtime.getPublicSitemapPage,
        PUBLIC_PAGE_ARGS
      )
    ).rejects.toMatchObject({
      data: { code: "PUBLIC_SITEMAP_PAGE_INTEGRITY" },
    });
  });
});

function getCommittedSitemapPage(ctx: MutationCtx) {
  return ctx.db
    .query("publicRouteSitemapPages")
    .withIndex("by_locale_and_syncedAt_and_page", (query) =>
      query.eq("locale", "en").eq("syncedAt", 2).eq("page", 0)
    )
    .unique();
}

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

async function seedContentSitemapGenerations(ctx: MutationCtx) {
  const oldFirstPageRoutes = Array.from({ length: 100 }, (_, index) =>
    contentRoutePageItem(`articles/fixture/old-page-0-route-${index}`, 1)
  );
  const newFirstPageRoutes = Array.from({ length: 100 }, (_, index) =>
    contentRoutePageItem(`articles/fixture/new-page-0-route-${index}`, 2)
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
    routes: oldFirstPageRoutes,
    section: "articles",
    syncedAt: 1,
  });
  await ctx.db.insert("contentRoutePages", {
    locale: "en",
    page: 1,
    routeCount: 1,
    routes: [contentRoutePageItem("articles/fixture/old-page-1-route-0", 1)],
    section: "articles",
    syncedAt: 1,
  });
  await ctx.db.insert("contentRoutePages", {
    locale: "en",
    page: 0,
    routeCount: 100,
    routes: newFirstPageRoutes,
    section: "articles",
    syncedAt: 2,
  });
  await ctx.db.insert("contentRoutePages", {
    locale: "en",
    page: 1,
    routeCount: 1,
    routes: [contentRoutePageItem("articles/fixture/new-page-1-route-0", 2)],
    section: "articles",
    syncedAt: 2,
  });
}

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

async function seedSitemapPage(ctx: MutationCtx) {
  await ctx.db.insert("publicRouteSitemapCounts", {
    count: 2,
    hash: "count-hash",
    locale: "en",
    pageCount: 1,
    syncedAt: 2,
  });
  await ctx.db.insert("publicRouteSitemapPages", {
    locale: "en",
    page: 0,
    paths: ["curriculum/fixture/old"],
    syncedAt: 1,
  });
  await ctx.db.insert("publicRouteSitemapPages", {
    locale: "en",
    page: 0,
    paths: ["curriculum/fixture/a", "curriculum/fixture/c"],
    syncedAt: 2,
  });
  await ctx.db.insert("publicRouteSitemapPages", {
    locale: "en",
    page: 0,
    paths: ["curriculum/fixture/future"],
    syncedAt: 3,
  });
}
