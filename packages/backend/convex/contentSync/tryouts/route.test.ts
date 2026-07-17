import { syncTryoutRoute } from "@repo/backend/convex/contentSync/tryouts/route";
import schema from "@repo/backend/convex/schema";
import { convexModules } from "@repo/backend/convex/test.setup";
import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";

const TRACK_ROUTE = "try-out/indonesia/tka/matematika";

describe("contentSync/tryouts/route", () => {
  it("removes route projections when a published route becomes unready", async () => {
    const t = convexTest(schema, convexModules);
    const readRouteRows = () =>
      t.query(async (ctx) => ({
        route: await ctx.db
          .query("contentRoutes")
          .withIndex("by_locale_and_sourcePath", (query) =>
            query.eq("locale", "id").eq("sourcePath", TRACK_ROUTE)
          )
          .unique(),
        search: await ctx.db
          .query("contentSearch")
          .withIndex("by_locale_and_sourcePath", (query) =>
            query.eq("locale", "id").eq("sourcePath", TRACK_ROUTE)
          )
          .unique(),
      }));
    const route = {
      contentHash: "track-hash",
      isReady: true,
      kind: "tryout-track" as const,
      locale: "id" as const,
      publicPath: TRACK_ROUTE,
      sourcePath: TRACK_ROUTE,
      title: "Matematika",
    };

    await t.mutation(async (ctx) => await syncTryoutRoute(ctx, route, 1));

    const published = await readRouteRows();

    expect(published.route).not.toBeNull();
    expect(published.search).not.toBeNull();

    await t.mutation(
      async (ctx) => await syncTryoutRoute(ctx, { ...route, isReady: false }, 2)
    );

    const rows = await readRouteRows();

    expect(rows).toEqual({ route: null, search: null });
  });
});
