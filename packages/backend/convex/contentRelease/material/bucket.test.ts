import { CONTENT_BUCKET_SIZE } from "@repo/backend/convex/contentRelease/bucket";
import { adjustMaterialBucket } from "@repo/backend/convex/contentRelease/material/bucket";
import { runConvexProgram } from "@repo/backend/convex/lib/effect";
import schema from "@repo/backend/convex/schema";
import { convexModules } from "@repo/backend/convex/test.setup";
import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";

describe("contentRelease/material/bucket", () => {
  it("creates, updates, and removes one material partition", async () => {
    const target = convexTest(schema, convexModules);

    await target.mutation((ctx) =>
      runConvexProgram(adjustMaterialBucket(ctx, "en", "abc", 1))
    );
    await target.mutation((ctx) =>
      runConvexProgram(adjustMaterialBucket(ctx, "en", "abc", 1))
    );
    await expect(
      target.run((ctx) => ctx.db.query("materialBuckets").unique())
    ).resolves.toMatchObject({ bucket: "abc", count: 2, locale: "en" });

    await target.mutation((ctx) =>
      runConvexProgram(adjustMaterialBucket(ctx, "en", "abc", -1))
    );
    await target.mutation((ctx) =>
      runConvexProgram(adjustMaterialBucket(ctx, "en", "abc", -1))
    );
    await expect(
      target.run((ctx) => ctx.db.query("materialBuckets").unique())
    ).resolves.toBeNull();
  });

  it("rejects invalid, underflowing, and overflowing partitions", async () => {
    const target = convexTest(schema, convexModules);

    await expect(
      target.mutation((ctx) =>
        runConvexProgram(adjustMaterialBucket(ctx, "en", "invalid", 1))
      )
    ).rejects.toMatchObject({
      data: { code: "CONTENT_RELEASE_INTEGRITY" },
    });
    await expect(
      target.mutation((ctx) =>
        runConvexProgram(adjustMaterialBucket(ctx, "en", "abc", -1))
      )
    ).rejects.toMatchObject({
      data: { code: "CONTENT_RELEASE_INTEGRITY" },
    });

    await target.mutation((ctx) =>
      ctx.db.insert("materialBuckets", {
        bucket: "abc",
        count: CONTENT_BUCKET_SIZE,
        locale: "en",
      })
    );
    await expect(
      target.mutation((ctx) =>
        runConvexProgram(adjustMaterialBucket(ctx, "en", "abc", 1))
      )
    ).rejects.toMatchObject({
      data: { code: "CONTENT_RELEASE_LIMIT" },
    });
  });
});
