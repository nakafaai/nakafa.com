import {
  countMaterialBucket,
  type MigrationBucketCount,
  verifyMaterialBuckets,
} from "@repo/backend/convex/contentRelease/material/migration/buckets";
import { runConvexProgram } from "@repo/backend/convex/lib/effect";
import schema from "@repo/backend/convex/schema";
import { convexModules } from "@repo/backend/convex/test.setup";
import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";

describe("contentRelease/material/migration/buckets", () => {
  it("rejects missing, unexpected, or duplicate discovery buckets", async () => {
    const unexpectedTarget = convexTest(schema, convexModules);
    await unexpectedTarget.mutation((ctx) =>
      ctx.db.insert("materialBuckets", {
        bucket: "000",
        count: 1,
        locale: "en",
      })
    );
    await expect(
      unexpectedTarget.mutation((ctx) =>
        runConvexProgram(
          verifyMaterialBuckets(ctx, new Map<string, MigrationBucketCount>())
        )
      )
    ).rejects.toMatchObject({
      data: { code: "CONTENT_RELEASE_INTEGRITY" },
    });

    const missing = new Map<string, MigrationBucketCount>();
    countMaterialBucket(missing, "en", "000");
    const missingTarget = convexTest(schema, convexModules);
    await expect(
      missingTarget.mutation((ctx) =>
        runConvexProgram(verifyMaterialBuckets(ctx, missing))
      )
    ).rejects.toMatchObject({
      data: { code: "CONTENT_RELEASE_INTEGRITY" },
    });

    const duplicate = new Map<string, MigrationBucketCount>();
    countMaterialBucket(duplicate, "en", "000");
    countMaterialBucket(duplicate, "en", "001");
    const duplicateTarget = convexTest(schema, convexModules);
    await duplicateTarget.mutation(async (ctx) => {
      await ctx.db.insert("materialBuckets", {
        bucket: "000",
        count: 1,
        locale: "en",
      });
      await ctx.db.insert("materialBuckets", {
        bucket: "000",
        count: 1,
        locale: "en",
      });
    });
    await expect(
      duplicateTarget.mutation((ctx) =>
        runConvexProgram(verifyMaterialBuckets(ctx, duplicate))
      )
    ).rejects.toMatchObject({
      data: { code: "CONTENT_RELEASE_INTEGRITY" },
    });
  });

  it("rejects discovery buckets beyond the guarded scope", async () => {
    const target = convexTest(schema, convexModules);
    await target.mutation(async (ctx) => {
      for (let index = 0; index <= 100; index += 1) {
        await ctx.db.insert("materialBuckets", {
          bucket: index.toString(16).padStart(3, "0"),
          count: 1,
          locale: "en",
        });
      }
    });

    await expect(
      target.mutation((ctx) =>
        runConvexProgram(
          verifyMaterialBuckets(ctx, new Map<string, MigrationBucketCount>())
        )
      )
    ).rejects.toMatchObject({
      data: { code: "CONTENT_RELEASE_LIMIT" },
    });
  });
});
