import { assert, describe, expect, it } from "@effect/vitest";
import {
  DatabaseReader,
  MutationCtx,
} from "@repo/backend/confect/_generated/services";
import { Confect, confectLayer } from "@repo/backend/confect/test.setup";
import { programLayer } from "@repo/backend/content/program/confect";
import { readProgramPartition } from "@repo/backend/content/program/partition";
import {
  activateProgramSnapshot,
  makeProgramSnapshotData,
} from "@repo/backend/test/program/snapshot";
import { Effect } from "effect";

/** Reads the sole English bucket from the technical snapshot fixture. */
const readEnglishBucket = Effect.fn("test.program.readEnglishBucket")(
  function* (snapshotId: string) {
    const reader = yield* DatabaseReader;
    const buckets = yield* reader
      .table("programBuckets")
      .index("by_snapshotId_and_appLocale_and_bucket", (query) =>
        query.eq("snapshotId", snapshotId).eq("appLocale", "en")
      )
      .take(2);
    const bucket = buckets[0]?.bucket;
    assert(bucket);
    return bucket;
  }
);
describe("contentRelease/program/partition", () => {
  it.live("distinguishes unmanaged, missing, and invalid partitions", () =>
    Effect.gen(function* () {
      const target = yield* Confect.pipe(Effect.provide(confectLayer));
      yield* target.run(
        Effect.gen(function* () {
          const _targetCtx = yield* MutationCtx;
          expect(
            yield* readProgramPartition("en", "abc").pipe(
              Effect.provide(programLayer)
            )
          ).toEqual({
            kind: "unmanaged",
          });
          expect(
            yield* readProgramPartition("en", "invalid").pipe(
              Effect.provide(programLayer),
              Effect.flip
            )
          ).toMatchObject({
            code: "CONTENT_RELEASE_LIMIT",
          });
          const data = yield* makeProgramSnapshotData();
          yield* activateProgramSnapshot(data);
          expect(
            yield* readProgramPartition("en", "fff").pipe(
              Effect.provide(programLayer)
            )
          ).toEqual({
            kind: "missing",
          });
        })
      );
    })
  );
  it.live("returns a complete verified partition and rejects count drift", () =>
    Effect.gen(function* () {
      const data = yield* makeProgramSnapshotData();
      const target = yield* Confect.pipe(Effect.provide(confectLayer));
      yield* target.run(
        Effect.gen(function* () {
          const targetCtx = yield* MutationCtx;
          yield* activateProgramSnapshot(data);
          const bucket = yield* readEnglishBucket(data.snapshotId);
          expect(
            yield* readProgramPartition("en", bucket).pipe(
              Effect.provide(programLayer)
            )
          ).toMatchObject({
            kind: "found",
            routes: [
              {
                appLocale: "en",
                sitemap: true,
              },
            ],
          });
          const count = yield* Effect.promise(() =>
            targetCtx.db
              .query("programBuckets")
              .withIndex("by_snapshotId_and_appLocale_and_bucket", (query) =>
                query
                  .eq("snapshotId", data.snapshotId)
                  .eq("appLocale", "en")
                  .eq("bucket", bucket)
              )
              .unique()
          );
          if (!count) {
            throw new Error("Expected one program sitemap bucket.");
          }
          yield* Effect.promise(() =>
            targetCtx.db.patch("programBuckets", count._id, {
              routeCount: count.routeCount + 1,
            })
          );
          expect(
            yield* readProgramPartition("en", bucket).pipe(
              Effect.provide(programLayer),
              Effect.flip
            )
          ).toMatchObject({
            code: "CONTENT_RELEASE_INTEGRITY",
          });
        })
      );
    })
  );
});
