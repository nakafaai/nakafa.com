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
} from "@repo/backend/test/program-snapshot";
import { convexTest } from "convex-test";
import { Effect } from "effect";
import { describe, expect, it } from "vitest";

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

  it("lists and reads complete active curriculum sitemap partitions", async () => {
    const data = await Effect.runPromise(makeProgramSnapshotData());
    const target = convexTest(schema, convexModules);
    await activateProgramSnapshot(target, data);
    const result = await target.query((ctx) =>
      runConvexProgram(readProgramBuckets(ctx, "en"))
    );

    expect(result).toMatchObject({ managed: true, routeCount: 2 });
    expect(result.buckets.length).toBeGreaterThan(0);
    const pages = await Promise.all(
      result.buckets.map((bucket) =>
        target.query((ctx) =>
          runConvexProgram(readProgramSitemap(ctx, "en", bucket))
        )
      )
    );
    expect(pages.flatMap((page) => page?.routes ?? [])).toEqual(
      expect.arrayContaining([
        { publicPath: "curriculum/technical-program-1" },
        { publicPath: "curriculum/technical-program-2" },
      ])
    );
  });

  it("rejects malformed stored partition metadata", async () => {
    const data = await Effect.runPromise(makeProgramSnapshotData());
    const target = convexTest(schema, convexModules);
    await activateProgramSnapshot(target, data);
    await target.mutation((ctx) =>
      ctx.db.insert("programBuckets", {
        appLocale: "en",
        bucket: "invalid",
        index: 100,
        routeCount: 0,
        snapshotId: data.snapshotId,
      })
    );

    await expect(
      target.query((ctx) => runConvexProgram(readProgramBuckets(ctx, "en")))
    ).rejects.toMatchObject({
      data: { code: "CONTENT_RELEASE_INTEGRITY" },
    });
  });
});
