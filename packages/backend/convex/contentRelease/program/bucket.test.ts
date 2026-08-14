import { CONTENT_BUCKET_SIZE } from "@repo/backend/convex/contentRelease/bucket";
import { addProgramBucketRoute } from "@repo/backend/convex/contentRelease/program/bucket";
import { runConvexProgram } from "@repo/backend/convex/lib/effect";
import schema from "@repo/backend/convex/schema";
import { convexModules } from "@repo/backend/convex/test.setup";
import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";

describe("contentRelease/program/bucket", () => {
  it("creates and increments one snapshot-local sitemap partition", async () => {
    const target = convexTest(schema, convexModules);

    await target.mutation((ctx) =>
      runConvexProgram(addProgramBucketRoute(ctx, "snapshot", 4, "en", "abc"))
    );
    await target.mutation((ctx) =>
      runConvexProgram(addProgramBucketRoute(ctx, "snapshot", 9, "en", "abc"))
    );

    await expect(
      target.run((ctx) => ctx.db.query("programBuckets").unique())
    ).resolves.toMatchObject({
      appLocale: "en",
      bucket: "abc",
      index: 4,
      routeCount: 2,
      snapshotId: "snapshot",
    });
  });

  it("rejects invalid and overflowing sitemap partitions", async () => {
    const target = convexTest(schema, convexModules);

    await expect(
      target.mutation((ctx) =>
        runConvexProgram(
          addProgramBucketRoute(ctx, "snapshot", 0, "en", "invalid")
        )
      )
    ).rejects.toMatchObject({
      data: { code: "CONTENT_RELEASE_INTEGRITY" },
    });

    await target.mutation((ctx) =>
      ctx.db.insert("programBuckets", {
        appLocale: "en",
        bucket: "abc",
        index: 0,
        routeCount: CONTENT_BUCKET_SIZE,
        snapshotId: "snapshot",
      })
    );
    await expect(
      target.mutation((ctx) =>
        runConvexProgram(addProgramBucketRoute(ctx, "snapshot", 1, "en", "abc"))
      )
    ).rejects.toMatchObject({
      data: { code: "CONTENT_RELEASE_LIMIT" },
    });
  });
});
