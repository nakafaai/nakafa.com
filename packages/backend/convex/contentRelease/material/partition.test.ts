import { readMaterialPartition } from "@repo/backend/convex/contentRelease/material/partition";
import { runConvexProgram } from "@repo/backend/convex/lib/effect";
import schema from "@repo/backend/convex/schema";
import { convexModules } from "@repo/backend/convex/test.setup";
import { makeMaterialProjection } from "@repo/backend/test/content-material";
import {
  activateMaterialCatalog,
  MATERIAL_IDENTITY,
  selectExactMaterial,
} from "@repo/backend/test/material-catalog";
import { convexTest, type TestConvex } from "convex-test";
import { describe, expect, it } from "vitest";

/** Reads one concrete English material partition from the test catalog. */
async function readEnglishBucket(target: TestConvex<typeof schema>) {
  const row = await target.run((ctx) =>
    ctx.db
      .query("materialBuckets")
      .withIndex("by_locale_and_bucket", (query) => query.eq("locale", "en"))
      .first()
  );
  if (!row) {
    throw new Error("Expected one English material bucket.");
  }
  return row;
}

/** Reads the partition row that stores one selected material path. */
async function readMaterialBucket(
  target: TestConvex<typeof schema>,
  publicPath: string
) {
  const row = await target.run((ctx) =>
    ctx.db
      .query("materialCatalog")
      .withIndex("by_locale_and_publicPath", (query) =>
        query.eq("locale", "en").eq("publicPath", publicPath)
      )
      .unique()
  );
  if (!row) {
    throw new Error("Expected one selected material row.");
  }
  const bucket = await target.run((ctx) =>
    ctx.db
      .query("materialBuckets")
      .withIndex("by_locale_and_bucket", (query) =>
        query.eq("locale", "en").eq("bucket", row.bucket)
      )
      .unique()
  );
  if (!bucket) {
    throw new Error("Expected one selected material bucket.");
  }
  return bucket;
}

describe("contentRelease/material/partition", () => {
  it("distinguishes unmanaged, invalid, and managed-missing partitions", async () => {
    const target = convexTest(schema, convexModules);

    await expect(
      target.query((ctx) =>
        runConvexProgram(readMaterialPartition(ctx, "en", "abc"))
      )
    ).resolves.toEqual({ activeReleaseId: null, kind: "unmanaged" });
    await expect(
      target.query((ctx) =>
        runConvexProgram(readMaterialPartition(ctx, "en", "invalid"))
      )
    ).rejects.toMatchObject({
      data: { code: "CONTENT_RELEASE_LIMIT" },
    });

    await activateMaterialCatalog(target);
    await expect(
      target.query((ctx) =>
        runConvexProgram(readMaterialPartition(ctx, "en", "fff"))
      )
    ).resolves.toEqual({
      activeReleaseId: MATERIAL_IDENTITY.releaseId,
      kind: "missing",
    });
  });

  it("returns a verified partition and rejects count drift", async () => {
    const target = convexTest(schema, convexModules);
    await activateMaterialCatalog(target);
    const bucket = await readEnglishBucket(target);

    await expect(
      target.query((ctx) =>
        runConvexProgram(readMaterialPartition(ctx, "en", bucket.bucket))
      )
    ).resolves.toMatchObject({
      activeReleaseId: MATERIAL_IDENTITY.releaseId,
      kind: "found",
      materials: [{ projection: { locale: "en", sitemap: true } }],
    });

    await target.mutation((ctx) =>
      ctx.db.patch("materialBuckets", bucket._id, {
        count: bucket.count + 1,
      })
    );
    await expect(
      target.query((ctx) =>
        runConvexProgram(readMaterialPartition(ctx, "en", bucket.bucket))
      )
    ).rejects.toMatchObject({
      data: { code: "CONTENT_RELEASE_INTEGRITY" },
    });
  });

  it("returns only exact-owned rows from a shared partial partition", async () => {
    const target = convexTest(schema, convexModules);
    const selected = makeMaterialProjection("en", 1);
    await activateMaterialCatalog(target);
    await selectExactMaterial(target, selected);
    const bucket = await readMaterialBucket(target, selected.publicPath);

    await expect(
      target.query((ctx) =>
        runConvexProgram(readMaterialPartition(ctx, "en", bucket.bucket))
      )
    ).resolves.toMatchObject({
      activeReleaseId: MATERIAL_IDENTITY.releaseId,
      kind: "found",
      materials: [{ projection: selected }],
    });
  });
});
