import { readProgramPartition } from "@repo/backend/convex/contentRelease/program/partition";
import { runConvexProgram } from "@repo/backend/convex/lib/effect";
import schema from "@repo/backend/convex/schema";
import { convexModules } from "@repo/backend/convex/test.setup";
import {
  activateProgramSnapshot,
  makeProgramSnapshotData,
} from "@repo/backend/test/program-snapshot";
import { convexTest, type TestConvex } from "convex-test";
import { Effect } from "effect";
import { describe, expect, it } from "vitest";

/** Reads the sole English bucket from the technical snapshot fixture. */
async function readEnglishBucket(
  target: TestConvex<typeof schema>,
  snapshotId: string
) {
  const buckets = await target.run((ctx) =>
    ctx.db
      .query("programBuckets")
      .withIndex("by_snapshotId_and_appLocale_and_bucket", (query) =>
        query.eq("snapshotId", snapshotId).eq("appLocale", "en")
      )
      .take(2)
  );
  const bucket = buckets[0]?.bucket;
  if (!bucket) {
    throw new Error("Expected one English program sitemap bucket.");
  }
  return bucket;
}

describe("contentRelease/program/partition", () => {
  it("distinguishes unmanaged, missing, and invalid partitions", async () => {
    const target = convexTest(schema, convexModules);

    await expect(
      target.query((ctx) =>
        runConvexProgram(readProgramPartition(ctx, "en", "abc"))
      )
    ).resolves.toEqual({ kind: "unmanaged" });
    await expect(
      target.query((ctx) =>
        runConvexProgram(readProgramPartition(ctx, "en", "invalid"))
      )
    ).rejects.toMatchObject({
      data: { code: "CONTENT_RELEASE_LIMIT" },
    });

    const data = await Effect.runPromise(makeProgramSnapshotData());
    await activateProgramSnapshot(target, data);
    await expect(
      target.query((ctx) =>
        runConvexProgram(readProgramPartition(ctx, "en", "fff"))
      )
    ).resolves.toEqual({ kind: "missing" });
  });

  it("returns a complete verified partition and rejects count drift", async () => {
    const data = await Effect.runPromise(makeProgramSnapshotData());
    const target = convexTest(schema, convexModules);
    await activateProgramSnapshot(target, data);
    const bucket = await readEnglishBucket(target, data.snapshotId);

    await expect(
      target.query((ctx) =>
        runConvexProgram(readProgramPartition(ctx, "en", bucket))
      )
    ).resolves.toMatchObject({
      kind: "found",
      routes: [{ appLocale: "en", sitemap: true }],
    });

    await target.mutation(async (ctx) => {
      const count = await ctx.db
        .query("programBuckets")
        .withIndex("by_snapshotId_and_appLocale_and_bucket", (query) =>
          query
            .eq("snapshotId", data.snapshotId)
            .eq("appLocale", "en")
            .eq("bucket", bucket)
        )
        .unique();
      if (!count) {
        throw new Error("Expected one program sitemap bucket.");
      }
      await ctx.db.patch("programBuckets", count._id, {
        routeCount: count.routeCount + 1,
      });
    });
    await expect(
      target.query((ctx) =>
        runConvexProgram(readProgramPartition(ctx, "en", bucket))
      )
    ).rejects.toMatchObject({
      data: { code: "CONTENT_RELEASE_INTEGRITY" },
    });
  });
});
