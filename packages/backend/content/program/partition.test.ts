import { describe, expect, it } from "@effect/vitest";
import { convexProgramLayer } from "@repo/backend/content/program/convex";
import { readProgramPartition } from "@repo/backend/content/program/partition";
import { runConvexProgram } from "@repo/backend/convex/lib/effect";
import schema from "@repo/backend/convex/schema";
import { convexModules } from "@repo/backend/convex/test.setup";
import {
  activateProgramSnapshot,
  makeProgramSnapshotData,
} from "@repo/backend/test/program/snapshot";
import { convexTest, type TestConvex } from "convex-test";
import { Effect } from "effect";

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
  it.live("distinguishes unmanaged, missing, and invalid partitions", () =>
    Effect.gen(function* () {
      const target = convexTest(schema, convexModules);

      yield* Effect.promise(() =>
        expect(
          target.query((ctx) =>
            runConvexProgram(
              readProgramPartition("en", "abc").pipe(
                Effect.provide(convexProgramLayer(ctx))
              )
            )
          )
        ).resolves.toEqual({ kind: "unmanaged" })
      );
      yield* Effect.promise(() =>
        expect(
          target.query((ctx) =>
            runConvexProgram(
              readProgramPartition("en", "invalid").pipe(
                Effect.provide(convexProgramLayer(ctx))
              )
            )
          )
        ).rejects.toMatchObject({
          data: { code: "CONTENT_RELEASE_LIMIT" },
        })
      );

      const data = yield* makeProgramSnapshotData();
      yield* Effect.promise(() => activateProgramSnapshot(target, data));
      yield* Effect.promise(() =>
        expect(
          target.query((ctx) =>
            runConvexProgram(
              readProgramPartition("en", "fff").pipe(
                Effect.provide(convexProgramLayer(ctx))
              )
            )
          )
        ).resolves.toEqual({ kind: "missing" })
      );
    })
  );

  it.live("returns a complete verified partition and rejects count drift", () =>
    Effect.gen(function* () {
      const data = yield* makeProgramSnapshotData();
      const target = convexTest(schema, convexModules);
      yield* Effect.promise(() => activateProgramSnapshot(target, data));
      const bucket = yield* Effect.promise(() =>
        readEnglishBucket(target, data.snapshotId)
      );

      yield* Effect.promise(() =>
        expect(
          target.query((ctx) =>
            runConvexProgram(
              readProgramPartition("en", bucket).pipe(
                Effect.provide(convexProgramLayer(ctx))
              )
            )
          )
        ).resolves.toMatchObject({
          kind: "found",
          routes: [{ appLocale: "en", sitemap: true }],
        })
      );

      yield* Effect.promise(() =>
        target.mutation(async (ctx) => {
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
        })
      );
      yield* Effect.promise(() =>
        expect(
          target.query((ctx) =>
            runConvexProgram(
              readProgramPartition("en", bucket).pipe(
                Effect.provide(convexProgramLayer(ctx))
              )
            )
          )
        ).rejects.toMatchObject({
          data: { code: "CONTENT_RELEASE_INTEGRITY" },
        })
      );
    })
  );
});
