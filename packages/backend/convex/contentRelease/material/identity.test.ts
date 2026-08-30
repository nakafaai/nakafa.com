import { describe, expect, it } from "@effect/vitest";
import { readMaterialIdentity } from "@repo/backend/convex/contentRelease/material/identity";
import { runConvexProgram } from "@repo/backend/convex/lib/effect";
import schema from "@repo/backend/convex/schema";
import { convexModules } from "@repo/backend/convex/test.setup";
import { makeMaterialProjection } from "@repo/backend/test/content/material";
import {
  activateMaterialCatalog,
  advanceMaterialCatalog,
  MATERIAL_IDENTITY,
} from "@repo/backend/test/material/catalog";
import { convexTest } from "convex-test";

const projection = makeMaterialProjection("en", 1);
const identity = {
  appLocale: projection.appLocale,
  contentKey: projection.contentKey,
  expectedMaterialKey: projection.materialKey,
  expectedSectionKey: projection.sectionKey,
};

describe("contentRelease/material/identity", () => {
  it("resolves one exact active signed material", async () => {
    const target = convexTest(schema, convexModules);
    await activateMaterialCatalog(target);

    await expect(
      target.query((ctx) =>
        runConvexProgram(readMaterialIdentity(ctx, identity))
      )
    ).resolves.toEqual({
      activeReleaseId: MATERIAL_IDENTITY.releaseId,
      managed: true,
      publicPath: projection.publicPath,
    });
  });

  it("resolves an inherited material through its effective active head", async () => {
    const target = convexTest(schema, convexModules);
    await activateMaterialCatalog(target);
    await advanceMaterialCatalog(target);

    await expect(
      target.query((ctx) =>
        runConvexProgram(readMaterialIdentity(ctx, identity))
      )
    ).resolves.toEqual({
      activeReleaseId: "release-next",
      managed: true,
      publicPath: projection.publicPath,
    });
  });

  it("distinguishes unmanaged and absent material identities", async () => {
    const unmanaged = convexTest(schema, convexModules);
    await expect(
      unmanaged.query((ctx) =>
        runConvexProgram(readMaterialIdentity(ctx, identity))
      )
    ).resolves.toEqual({
      activeReleaseId: null,
      managed: false,
      publicPath: null,
    });

    const absent = convexTest(schema, convexModules);
    await activateMaterialCatalog(absent);
    await expect(
      absent.query((ctx) =>
        runConvexProgram(
          readMaterialIdentity(ctx, {
            ...identity,
            contentKey: "material/lesson/test/missing/section-1",
          })
        )
      )
    ).resolves.toMatchObject({ managed: true, publicPath: null });
  });

  it("rejects mismatched claims and stale active rows", async () => {
    const mismatch = convexTest(schema, convexModules);
    await activateMaterialCatalog(mismatch);
    await expect(
      mismatch.query((ctx) =>
        runConvexProgram(
          readMaterialIdentity(ctx, {
            ...identity,
            expectedSectionKey: "section-2",
          })
        )
      )
    ).rejects.toMatchObject({
      data: { code: "CONTENT_RELEASE_INTEGRITY" },
    });

    const stale = convexTest(schema, convexModules);
    await activateMaterialCatalog(stale);
    await stale.mutation(async (ctx) => {
      const row = await ctx.db
        .query("materialCatalog")
        .withIndex("by_slot_and_contentKey_and_appLocale", (index) =>
          index
            .eq("slot", "blue")
            .eq("contentKey", projection.contentKey)
            .eq("appLocale", projection.appLocale)
        )
        .unique();
      if (!row) {
        throw new Error("Expected one current material row.");
      }
      await ctx.db.patch("materialCatalog", row._id, { sequence: 2 });
    });
    await expect(
      stale.query((ctx) =>
        runConvexProgram(readMaterialIdentity(ctx, identity))
      )
    ).rejects.toMatchObject({
      data: { code: "CONTENT_RELEASE_INTEGRITY" },
    });
  });

  it("rejects malformed stable identity inputs", async () => {
    const target = convexTest(schema, convexModules);

    await expect(
      target.query((ctx) =>
        runConvexProgram(
          readMaterialIdentity(ctx, {
            ...identity,
            expectedMaterialKey: "invalid",
          })
        )
      )
    ).rejects.toMatchObject({
      data: { code: "CONTENT_RELEASE_LIMIT" },
    });
  });
});
