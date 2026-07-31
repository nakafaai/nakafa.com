import { validateSourceMaterialRoutes } from "@repo/backend/convex/contentRelease/material/routeGuard";
import { runConvexProgram } from "@repo/backend/convex/lib/effect";
import schema from "@repo/backend/convex/schema";
import { convexModules } from "@repo/backend/convex/test.setup";
import { makeMaterialProjection } from "@repo/backend/test/content-material";
import {
  activateMaterialCatalog,
  MATERIAL_IDENTITY,
  selectExactMaterial,
} from "@repo/backend/test/material-catalog";
import { convexTest } from "convex-test";
import { assert, describe, expect, it } from "vitest";

describe("contentRelease/material/routeGuard", () => {
  it("validates only the exact owner for the changed source path", async () => {
    const target = convexTest(schema, convexModules);
    const selected = makeMaterialProjection("en", 1);
    const unrelated = makeMaterialProjection("en", 2);
    await activateMaterialCatalog(target, [selected, unrelated]);
    await selectExactMaterial(target, selected);
    await selectExactMaterial(target, unrelated);
    await target.mutation(async (ctx) => {
      const unrelatedHead = await ctx.db
        .query("contentHeads")
        .withIndex("by_contentKey_and_locale_and_sequence", (index) =>
          index
            .eq("contentKey", unrelated.contentKey)
            .eq("locale", unrelated.locale)
            .eq("sequence", MATERIAL_IDENTITY.sequence)
        )
        .unique();
      assert(unrelatedHead, "Expected the unrelated exact material head.");
      await ctx.db.delete(unrelatedHead._id);
    });

    await expect(
      target.mutation((ctx) =>
        runConvexProgram(
          validateSourceMaterialRoutes(ctx, [
            {
              locale: selected.locale,
              publicPath: selected.publicPath,
              sourcePath: selected.contentKey,
            },
          ])
        )
      )
    ).resolves.toBeNull();

    await expect(
      target.mutation((ctx) =>
        runConvexProgram(
          validateSourceMaterialRoutes(ctx, [
            {
              locale: selected.locale,
              publicPath: selected.publicPath,
              sourcePath: "material/lesson/test/another-owner",
            },
          ])
        )
      )
    ).rejects.toMatchObject({
      data: { code: "CONTENT_RELEASE_ROUTE" },
    });
  });

  it("protects every route owned by a full material release", async () => {
    const target = convexTest(schema, convexModules);
    const selected = makeMaterialProjection("en", 1);
    await activateMaterialCatalog(target, [selected]);

    await expect(
      target.mutation((ctx) =>
        runConvexProgram(
          validateSourceMaterialRoutes(ctx, [
            {
              locale: selected.locale,
              publicPath: selected.publicPath,
              sourcePath: selected.contentKey,
            },
          ])
        )
      )
    ).resolves.toBeNull();

    await expect(
      target.mutation((ctx) =>
        runConvexProgram(
          validateSourceMaterialRoutes(ctx, [
            {
              locale: selected.locale,
              publicPath: selected.publicPath,
              sourcePath: "material/lesson/test/another-owner",
            },
          ])
        )
      )
    ).rejects.toMatchObject({
      data: { code: "CONTENT_RELEASE_ROUTE" },
    });
  });
});
