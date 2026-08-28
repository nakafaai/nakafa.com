import { describe, expect, it } from "@effect/vitest";
import { CONTENT_BUCKET_SIZE } from "@repo/backend/convex/contentRelease/bucket";
import { addProgramBucketRoute } from "@repo/backend/convex/contentRelease/program/bucket";
import { runConvexProgram } from "@repo/backend/convex/lib/effect";
import schema from "@repo/backend/convex/schema";
import { convexModules } from "@repo/backend/convex/test.setup";
import { convexTest } from "convex-test";
import { Effect } from "effect";

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
        target.run((ctx) => ctx.db.query("programBuckets").unique())
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

      yield* Effect.promise(() =>
        expect(
          target.mutation((ctx) =>
            runConvexProgram(
              addProgramBucketRoute(ctx, "snapshot", 0, "en", "invalid")
            )
          )
        ).rejects.toMatchObject({
          data: { code: "CONTENT_RELEASE_INTEGRITY" },
        })
      );

      yield* Effect.promise(() =>
        target.mutation((ctx) =>
          ctx.db.insert("programBuckets", {
            appLocale: "en",
            bucket: "abc",
            index: 0,
            routeCount: CONTENT_BUCKET_SIZE,
            snapshotId: "snapshot",
          })
        )
      );
      yield* Effect.promise(() =>
        expect(
          target.mutation((ctx) =>
            runConvexProgram(
              addProgramBucketRoute(ctx, "snapshot", 1, "en", "abc")
            )
          )
        ).rejects.toMatchObject({
          data: { code: "CONTENT_RELEASE_LIMIT" },
        })
      );
    })
  );
});
