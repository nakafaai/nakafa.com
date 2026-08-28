import { describe, expect, it } from "@effect/vitest";
import {
  readProgramBuckets,
  readProgramSitemap,
} from "@repo/backend/convex/contentRelease/program/sitemap";
import { runConvexProgram } from "@repo/backend/convex/lib/effect";
import schema from "@repo/backend/convex/schema";
import { convexModules } from "@repo/backend/convex/test.setup";
import {
  activateProgramSnapshot,
  makeProgramSnapshotData,
} from "@repo/backend/test/program/snapshot";
import { convexTest } from "convex-test";
import { Effect } from "effect";

describe("contentRelease/program/sitemap", () => {
  it("returns empty unmanaged discovery and no unmanaged page", async () => {
    const target = convexTest(schema, convexModules);

    await expect(
      target.query((ctx) => runConvexProgram(readProgramBuckets(ctx, "en")))
    ).resolves.toEqual({ buckets: [], managed: false, routeCount: 0 });
    await expect(
      target.query((ctx) =>
        runConvexProgram(readProgramSitemap(ctx, "en", "abc"))
      )
    ).resolves.toBeNull();
  });

  it.live("lists and reads complete active curriculum sitemap partitions", () =>
    Effect.gen(function* () {
      const data = yield* makeProgramSnapshotData();
      const target = convexTest(schema, convexModules);
      yield* Effect.promise(() => activateProgramSnapshot(target, data));
      const result = yield* Effect.promise(() =>
        target.query((ctx) => runConvexProgram(readProgramBuckets(ctx, "en")))
      );

      expect(result).toMatchObject({ managed: true, routeCount: 2 });
      expect(result.buckets.length).toBeGreaterThan(0);
      const pages = yield* Effect.promise(() =>
        Promise.all(
          result.buckets.map((bucket) =>
            target.query((ctx) =>
              runConvexProgram(readProgramSitemap(ctx, "en", bucket))
            )
          )
        )
      );
      expect(pages.flatMap((page) => page?.routes ?? [])).toEqual(
        expect.arrayContaining([
          { publicPath: "curriculum/technical-program-1" },
          { publicPath: "curriculum/technical-program-2" },
        ])
      );
    })
  );

  it.live("rejects malformed stored partition metadata", () =>
    Effect.gen(function* () {
      const data = yield* makeProgramSnapshotData();
      const target = convexTest(schema, convexModules);
      yield* Effect.promise(() => activateProgramSnapshot(target, data));
      yield* Effect.promise(() =>
        target.mutation((ctx) =>
          ctx.db.insert("programBuckets", {
            appLocale: "en",
            bucket: "invalid",
            index: 100,
            routeCount: 0,
            snapshotId: data.snapshotId,
          })
        )
      );

      yield* Effect.promise(() =>
        expect(
          target.query((ctx) => runConvexProgram(readProgramBuckets(ctx, "en")))
        ).rejects.toMatchObject({
          data: { code: "CONTENT_RELEASE_INTEGRITY" },
        })
      );
    })
  );
});
