import { api } from "@repo/backend/convex/_generated/api";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import schema from "@repo/backend/convex/schema";
import { convexModules } from "@repo/backend/convex/test.setup";
import { insertContentViewRoute } from "@repo/backend/test/content-view";
import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";

/** Inserts one dated source route for newest-first catalog tests. */
async function insertDatedRoute(ctx: MutationCtx, route: string, date: number) {
  await insertContentViewRoute(ctx, {
    contentId: `asset:id:catalog:article:${date}`,
    kind: "article",
    route,
    section: "articles",
    title: route,
  });
  const stored = await ctx.db
    .query("contentRoutes")
    .withIndex("by_locale_and_sourcePath", (index) =>
      index.eq("locale", "id").eq("sourcePath", route)
    )
    .unique();
  if (!stored) {
    expect.fail("Expected the dated route fixture.");
  }
  await ctx.db.patch("contentRoutes", stored._id, { date });
}

describe("content route artifact runtime", () => {
  it("rejects invalid artifact page numbers", async () => {
    const t = convexTest(schema, convexModules);

    await expect(
      t.query(api.contents.queries.runtime.getContentRouteArtifactPage, {
        locale: "id",
        page: -1,
        section: "articles",
      })
    ).rejects.toMatchObject({
      data: { code: "CONTENT_ROUTE_ARTIFACT_PAGE_INVALID" },
    });
  });

  it("rejects an invalid committed generation pointer", async () => {
    const t = convexTest(schema, convexModules);
    await t.mutation(async (ctx) => {
      await ctx.db.insert("contentRouteCounts", {
        count: 0,
        locale: "id",
        section: "articles",
        syncedAt: 0,
      });
    });

    await expect(
      t.query(api.contents.queries.runtime.getContentRouteArtifactPage, {
        locale: "id",
        page: 0,
        section: "articles",
      })
    ).rejects.toMatchObject({
      data: { code: "CONTENT_RUNTIME_INTEGRITY_ERROR" },
    });
  });

  it("paginates dated routes newest first within the public bound", async () => {
    const target = convexTest(schema, convexModules);
    await target.mutation(async (ctx) => {
      await insertDatedRoute(ctx, "articles/politics/older", 1);
      await insertDatedRoute(ctx, "articles/politics/newer", 2);
    });

    const first = await target.query(
      api.contents.queries.runtime.listLatestContentRoutePage,
      {
        cursor: null,
        limit: 1,
        locale: "id",
        section: "articles",
      }
    );
    const second = await target.query(
      api.contents.queries.runtime.listLatestContentRoutePage,
      {
        cursor: first.continueCursor,
        limit: 1,
        locale: "id",
        section: "articles",
      }
    );

    expect(first.page).toMatchObject([{ route: "articles/politics/newer" }]);
    expect(second.page).toMatchObject([{ route: "articles/politics/older" }]);
    await expect(
      target.query(api.contents.queries.runtime.listLatestContentRoutePage, {
        cursor: null,
        limit: 101,
        locale: "id",
        section: "articles",
      })
    ).rejects.toMatchObject({
      data: { code: "CONTENT_ROUTE_PAGE_LIMIT_INVALID" },
    });
  });
});
