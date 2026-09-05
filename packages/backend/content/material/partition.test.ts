import { describe, expect, it } from "@effect/vitest";
import { convexMaterialLayer } from "@repo/backend/content/material/convex";
import { readMaterialPartition } from "@repo/backend/content/material/partition";
import { runConvexProgram } from "@repo/backend/convex/lib/effect";
import schema from "@repo/backend/convex/schema";
import { convexModules } from "@repo/backend/convex/test.setup";
import {
  activateMaterialCatalog,
  MATERIAL_IDENTITY,
} from "@repo/backend/test/material/catalog";
import { convexTest, type TestConvex } from "convex-test";
import { Effect } from "effect";

/** Reads one concrete English material partition from the test catalog. */
async function readEnglishBucket(target: TestConvex<typeof schema>) {
  const row = await target.run((ctx) =>
    ctx.db
      .query("materialBuckets")
      .withIndex("by_slot_and_appLocale_and_bucket", (query) =>
        query.eq("slot", "blue").eq("appLocale", "en")
      )
      .first()
  );
  if (!row) {
    throw new Error("Expected one English material bucket.");
  }
  return row;
}

describe("contentRelease/material/partition", () => {
  it("distinguishes unmanaged, invalid, and managed-missing partitions", async () => {
    const target = convexTest(schema, convexModules);

    await expect(
      target.query((ctx) =>
        runConvexProgram(
          readMaterialPartition("en", "abc").pipe(
            Effect.provide(convexMaterialLayer(ctx))
          )
        )
      )
    ).resolves.toEqual({ activeReleaseId: null, kind: "unmanaged" });
    await expect(
      target.query((ctx) =>
        runConvexProgram(
          readMaterialPartition("en", "invalid").pipe(
            Effect.provide(convexMaterialLayer(ctx))
          )
        )
      )
    ).rejects.toMatchObject({
      data: { code: "CONTENT_RELEASE_LIMIT" },
    });

    await activateMaterialCatalog(target);
    await expect(
      target.query((ctx) =>
        runConvexProgram(
          readMaterialPartition("en", "fff").pipe(
            Effect.provide(convexMaterialLayer(ctx))
          )
        )
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
        runConvexProgram(
          readMaterialPartition("en", bucket.bucket).pipe(
            Effect.provide(convexMaterialLayer(ctx))
          )
        )
      )
    ).resolves.toMatchObject({
      activeReleaseId: MATERIAL_IDENTITY.releaseId,
      kind: "found",
      materials: [{ projection: { appLocale: "en", sitemap: true } }],
    });

    await target.mutation((ctx) =>
      ctx.db.patch("materialBuckets", bucket._id, {
        count: bucket.count + 1,
      })
    );
    await expect(
      target.query((ctx) =>
        runConvexProgram(
          readMaterialPartition("en", bucket.bucket).pipe(
            Effect.provide(convexMaterialLayer(ctx))
          )
        )
      )
    ).rejects.toMatchObject({
      data: { code: "CONTENT_RELEASE_INTEGRITY" },
    });
  });
});
