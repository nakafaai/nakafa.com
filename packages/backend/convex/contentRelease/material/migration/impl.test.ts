import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import { getHashBucket } from "@repo/backend/convex/contentRelease/bucket";
import { migrateMaterialCatalog } from "@repo/backend/convex/contentRelease/material/migration/impl";
import { runConvexProgram } from "@repo/backend/convex/lib/effect";
import schema from "@repo/backend/convex/schema";
import { convexModules } from "@repo/backend/convex/test.setup";
import {
  testMaterialGraph,
  testProjectionJson,
} from "@repo/backend/test/content-material";
import { testTextHash } from "@repo/backend/test/content-release";
import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";

/** Inserts one material row in the exact pre-expansion storage shape. */
async function insertOldMaterial(ctx: MutationCtx, index = 0) {
  const projectionJson = testProjectionJson({ index });
  const projectionHash = testTextHash(projectionJson);
  const contentKey = `test:head-${index}`;
  await ctx.db.insert("materialCatalog", {
    contentKey,
    locale: "en",
    materialKey: `lesson.test.head-${index}`,
    order: index + 1,
    parentPath: "test",
    projectionHash,
    projectionJson,
    publicPath: `test/head-${index}`,
    releaseId: "release-material-migration",
    rendererDomain: "mathematics",
    sequence: 1,
    sourcePath: `packages/corpus/test/head-${index}/en.mdx`,
  });
  return { contentKey, projectionHash };
}

describe("contentRelease/material/migration/impl", () => {
  it("previews, applies, and verifies the exact catalog expansion", async () => {
    const target = convexTest(schema, convexModules);
    const inserted = await target.mutation((ctx) => insertOldMaterial(ctx));

    await expect(
      target.mutation((ctx) =>
        runConvexProgram(
          migrateMaterialCatalog(ctx, {
            apply: false,
            expectedMissing: 1,
          })
        )
      )
    ).resolves.toEqual({ candidates: 1, updated: 0 });
    await expect(
      target.mutation((ctx) =>
        runConvexProgram(
          migrateMaterialCatalog(ctx, {
            apply: true,
            expectedMissing: 1,
          })
        )
      )
    ).resolves.toEqual({ candidates: 1, updated: 1 });
    await expect(
      target.mutation((ctx) =>
        runConvexProgram(
          migrateMaterialCatalog(ctx, {
            apply: false,
            expectedMissing: 0,
          })
        )
      )
    ).resolves.toEqual({ candidates: 0, updated: 0 });

    const state = await target.run(async (ctx) => ({
      bucket: await ctx.db.query("materialBuckets").unique(),
      material: await ctx.db.query("materialCatalog").unique(),
    }));
    expect(state.material).toMatchObject({
      assetId: testMaterialGraph("head-0", "head-0").assetId,
      bucket: getHashBucket(inserted.projectionHash),
      date: "2026-07-22",
    });
    expect(state.bucket).toMatchObject({
      bucket: getHashBucket(inserted.projectionHash),
      count: 1,
      locale: "en",
    });

    await target.mutation(async (ctx) => {
      const bucket = await ctx.db.query("materialBuckets").unique();
      if (!bucket) {
        throw new Error("Expected the migrated material bucket.");
      }
      await ctx.db.patch("materialBuckets", bucket._id, { count: 2 });
    });
    await expect(
      target.mutation((ctx) =>
        runConvexProgram(
          migrateMaterialCatalog(ctx, {
            apply: false,
            expectedMissing: 0,
          })
        )
      )
    ).rejects.toMatchObject({
      data: { code: "CONTENT_RELEASE_INTEGRITY" },
    });
  });

  it("rejects count drift and partial or corrupt catalog state", async () => {
    const target = convexTest(schema, convexModules);
    await target.mutation(async (ctx) => {
      await insertOldMaterial(ctx);
      const row = await ctx.db.query("materialCatalog").unique();
      if (!row) {
        throw new Error("Expected the material migration fixture.");
      }
      await ctx.db.patch("materialCatalog", row._id, {
        assetId: testMaterialGraph("head-0", "head-0").assetId,
      });
    });

    await expect(
      target.mutation((ctx) =>
        runConvexProgram(
          migrateMaterialCatalog(ctx, {
            apply: false,
            expectedMissing: 0,
          })
        )
      )
    ).rejects.toMatchObject({
      data: { code: "CONTENT_RELEASE_INTEGRITY" },
    });

    const countTarget = convexTest(schema, convexModules);
    await countTarget.mutation((ctx) => insertOldMaterial(ctx));
    await expect(
      countTarget.mutation((ctx) =>
        runConvexProgram(
          migrateMaterialCatalog(ctx, {
            apply: false,
            expectedMissing: 0,
          })
        )
      )
    ).rejects.toMatchObject({
      data: { code: "CONTENT_RELEASE_CONFLICT" },
    });
    await expect(
      countTarget.mutation((ctx) =>
        runConvexProgram(
          migrateMaterialCatalog(ctx, {
            apply: false,
            expectedMissing: -1,
          })
        )
      )
    ).rejects.toMatchObject({
      data: { code: "CONTENT_RELEASE_LIMIT" },
    });

    const corruptTarget = convexTest(schema, convexModules);
    await corruptTarget.mutation(async (ctx) => {
      await insertOldMaterial(ctx);
      const row = await ctx.db.query("materialCatalog").unique();
      if (!row) {
        throw new Error("Expected the material migration fixture.");
      }
      await ctx.db.patch("materialCatalog", row._id, {
        projectionHash: "invalid",
      });
    });
    await expect(
      corruptTarget.mutation((ctx) =>
        runConvexProgram(
          migrateMaterialCatalog(ctx, {
            apply: false,
            expectedMissing: 1,
          })
        )
      )
    ).rejects.toMatchObject({
      data: { code: "CONTENT_RELEASE_INTEGRITY" },
    });
  });

  it("rejects catalogs beyond the guarded pre-cutover scope", async () => {
    const target = convexTest(schema, convexModules);
    await target.mutation(async (ctx) => {
      for (let index = 0; index <= 100; index += 1) {
        await insertOldMaterial(ctx, index);
      }
    });

    await expect(
      target.mutation((ctx) =>
        runConvexProgram(
          migrateMaterialCatalog(ctx, {
            apply: false,
            expectedMissing: 100,
          })
        )
      )
    ).rejects.toMatchObject({
      data: { code: "CONTENT_RELEASE_LIMIT" },
    });
  });
});
