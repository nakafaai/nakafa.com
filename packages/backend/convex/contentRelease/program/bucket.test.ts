import { describe, expect, it } from "@effect/vitest";
import { CONTENT_BUCKET_SIZE } from "@repo/backend/convex/contentRelease/bucket";
import { addProgramBucketRoute } from "@repo/backend/convex/contentRelease/program/bucket";
import { runConvexProgram } from "@repo/backend/convex/lib/effect";
import schema from "@repo/backend/convex/schema";
import { convexModules } from "@repo/backend/convex/test.setup";
import { convexTest } from "convex-test";
import { Data, Effect } from "effect";

class ProgramBucketMutationRejected extends Data.TaggedError(
  "ProgramBucketMutationRejected"
)<{ readonly cause: unknown }> {}

describe("contentRelease/program/bucket", () => {
  it.effect("creates and increments one snapshot-local sitemap partition", () =>
    Effect.gen(function* () {
      const target = convexTest(schema, convexModules);

      yield* Effect.promise(() =>
        target.mutation((ctx) =>
          runConvexProgram(
            addProgramBucketRoute(ctx, "snapshot", 4, "en", "abc")
          )
        )
      );
      yield* Effect.promise(() =>
        target.mutation((ctx) =>
          runConvexProgram(
            addProgramBucketRoute(ctx, "snapshot", 9, "en", "abc")
          )
        )
      );

      const bucket = yield* Effect.promise(() =>
        target.run((ctx) =>
          runConvexProgram(
            Effect.promise(() => ctx.db.query("programBuckets").unique())
          )
        )
      );
      expect(bucket).toMatchObject({
        appLocale: "en",
        bucket: "abc",
        index: 4,
        routeCount: 2,
        snapshotId: "snapshot",
      });
    })
  );

  it.effect("rejects invalid and overflowing sitemap partitions", () =>
    Effect.gen(function* () {
      const target = convexTest(schema, convexModules);

      const invalidPartition = yield* Effect.tryPromise({
        try: () =>
          target.mutation((ctx) =>
            runConvexProgram(
              addProgramBucketRoute(ctx, "snapshot", 0, "en", "invalid")
            )
          ),
        catch: (cause) => new ProgramBucketMutationRejected({ cause }),
      }).pipe(Effect.flip);
      expect(invalidPartition.cause).toMatchObject({
        data: { code: "CONTENT_RELEASE_INTEGRITY" },
      });

      yield* Effect.promise(() =>
        target.mutation((ctx) =>
          runConvexProgram(
            Effect.promise(() =>
              ctx.db.insert("programBuckets", {
                appLocale: "en",
                bucket: "abc",
                index: 0,
                routeCount: CONTENT_BUCKET_SIZE,
                snapshotId: "snapshot",
              })
            )
          )
        )
      );
      const overflowingPartition = yield* Effect.tryPromise({
        try: () =>
          target.mutation((ctx) =>
            runConvexProgram(
              addProgramBucketRoute(ctx, "snapshot", 1, "en", "abc")
            )
          ),
        catch: (cause) => new ProgramBucketMutationRejected({ cause }),
      }).pipe(Effect.flip);
      expect(overflowingPartition.cause).toMatchObject({
        data: { code: "CONTENT_RELEASE_LIMIT" },
      });
    })
  );
});
