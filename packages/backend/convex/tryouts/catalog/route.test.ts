import { runConvexProgram } from "@repo/backend/convex/lib/effect";
import schema from "@repo/backend/convex/schema";
import { convexModules } from "@repo/backend/convex/test.setup";
import { readTryoutRoute } from "@repo/backend/convex/tryouts/catalog/route";
import {
  activateTryoutSnapshot,
  makeTryoutCatalogRow,
  makeTryoutPlacementRow,
} from "@repo/backend/test/tryout-snapshot";
import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";

/** Activates the smallest coherent localized route catalog. */
async function activateCatalog() {
  const t = convexTest(schema, convexModules);
  await t.mutation((ctx) =>
    activateTryoutSnapshot(ctx, {
      catalog: [
        makeTryoutCatalogRow("en").record.row,
        makeTryoutCatalogRow("id").record.row,
      ],
      placements: [
        makeTryoutPlacementRow("en").record.row,
        makeTryoutPlacementRow("id").record.row,
      ],
    })
  );
  return t;
}

describe("tryouts/catalog/route", () => {
  it("delegates route ownership before a signed try-out release", async () => {
    const t = convexTest(schema, convexModules);

    await expect(
      t.query((ctx) =>
        runConvexProgram(
          readTryoutRoute(ctx, {
            locale: "en",
            publicPath: "try-out/indonesia",
          })
        )
      )
    ).resolves.toEqual({ exists: false, managed: false });
  });

  it("accepts only exact routes from the active signed snapshot", async () => {
    const t = await activateCatalog();

    await expect(
      t.query((ctx) =>
        runConvexProgram(
          readTryoutRoute(ctx, {
            locale: "en",
            publicPath: "try-out/indonesia",
          })
        )
      )
    ).resolves.toEqual({ exists: true, managed: true });
    await expect(
      t.query((ctx) =>
        runConvexProgram(
          readTryoutRoute(ctx, {
            locale: "en",
            publicPath: "try-out/not-authored",
          })
        )
      )
    ).resolves.toEqual({ exists: false, managed: true });
  });

  it("fails closed when indexed route facts differ from the signed row", async () => {
    const t = await activateCatalog();
    await t.mutation(async (ctx) => {
      const snapshot = await ctx.db.query("contentSnapshots").unique();
      if (!snapshot) {
        throw new Error("Expected one active try-out snapshot.");
      }
      const row = await ctx.db
        .query("tryoutCatalog")
        .withIndex("by_snapshotId_and_locale_and_publicPath", (index) =>
          index
            .eq("snapshotId", snapshot.snapshotId)
            .eq("locale", "en")
            .eq("publicPath", "try-out/indonesia")
        )
        .unique();
      if (!row) {
        throw new Error("Expected one signed English try-out route.");
      }
      await ctx.db.patch("tryoutCatalog", row._id, { order: 2 });
    });

    await expect(
      t.query((ctx) =>
        runConvexProgram(
          readTryoutRoute(ctx, {
            locale: "en",
            publicPath: "try-out/indonesia",
          })
        )
      )
    ).rejects.toMatchObject({
      data: { code: "CONTENT_RELEASE_INTEGRITY" },
    });
  });
});
