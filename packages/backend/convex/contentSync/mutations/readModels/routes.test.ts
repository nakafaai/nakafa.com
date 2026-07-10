import { internal } from "@repo/backend/convex/_generated/api";
import schema from "@repo/backend/convex/schema";
import { convexModules } from "@repo/backend/convex/test.setup";
import type { FunctionArgs } from "convex/server";
import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";

type PublicRoutePayload = FunctionArgs<
  typeof internal.contentSync.mutations.readModels.routes.bulkSyncPublicRoutes
>["routes"][number];

const FIRST_SYNC = 1000;
const SECOND_SYNC = 2000;
const PUBLIC_ROUTE: PublicRoutePayload = {
  kind: "subject-lesson",
  locale: "id",
  materialDomain: "mathematics",
  materialKey: "lesson.mathematics.sequence-series",
  parentPath: "materi/matematika/barisan-dan-deret",
  publicPath: "materi/matematika/barisan-dan-deret/barisan-aritmetika",
  sectionKey: "arithmetic-sequence",
  sitemap: true,
  sourcePath: "material/lesson/mathematics/sequence-series/arithmetic-sequence",
  title: "Barisan Aritmetika",
};

describe("contentSync/mutations/readModels/routes", () => {
  it("refreshes unchanged public route rows before stale cleanup", async () => {
    const t = convexTest(schema, convexModules);

    const created = await t.mutation(
      internal.contentSync.mutations.readModels.routes.bulkSyncPublicRoutes,
      { routes: [PUBLIC_ROUTE], syncedAt: FIRST_SYNC }
    );
    const unchanged = await t.mutation(
      internal.contentSync.mutations.readModels.routes.bulkSyncPublicRoutes,
      { routes: [PUBLIC_ROUTE], syncedAt: SECOND_SYNC }
    );
    const staleDelete = await t.mutation(
      internal.contentSync.mutations.readModels.stale.deleteStalePublicRoutes,
      { limit: 10, syncedAt: SECOND_SYNC }
    );
    const row = await t.query(
      async (ctx) =>
        await ctx.db
          .query("publicRoutes")
          .withIndex("by_locale_and_publicPath", (q) =>
            q
              .eq("locale", PUBLIC_ROUTE.locale)
              .eq("publicPath", PUBLIC_ROUTE.publicPath)
          )
          .unique()
    );

    expect(created).toEqual({ created: 1, unchanged: 0, updated: 0 });
    expect(unchanged).toEqual({ created: 0, unchanged: 1, updated: 0 });
    expect(staleDelete).toEqual({ deleted: 0 });
    expect(row).toMatchObject({
      publicPath: PUBLIC_ROUTE.publicPath,
      syncedAt: SECOND_SYNC,
    });
  });
});
