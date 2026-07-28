import { adjustArticleBucket } from "@repo/backend/convex/contentRelease/article/bucket";
import { CONTENT_BUCKET_SIZE } from "@repo/backend/convex/contentRelease/bucket";
import { runConvexProgram } from "@repo/backend/convex/lib/effect";
import schema from "@repo/backend/convex/schema";
import { convexModules } from "@repo/backend/convex/test.setup";
import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";

describe("contentRelease/article/bucket", () => {
  it("creates, updates, and removes non-empty bucket counts", async () => {
    const t = convexTest(schema, convexModules);
    await t.mutation((ctx) =>
      runConvexProgram(adjustArticleBucket(ctx, "en", "abc", "article", 1))
    );
    await t.mutation((ctx) =>
      runConvexProgram(adjustArticleBucket(ctx, "en", "abc", "category", 1))
    );
    await expect(
      t.run((ctx) => ctx.db.query("articleBuckets").unique())
    ).resolves.toMatchObject({ articleCount: 1, categoryCount: 1 });

    await t.mutation((ctx) =>
      runConvexProgram(adjustArticleBucket(ctx, "en", "abc", "article", -1))
    );
    await t.mutation((ctx) =>
      runConvexProgram(adjustArticleBucket(ctx, "en", "abc", "category", -1))
    );
    await expect(
      t.run((ctx) => ctx.db.query("articleBuckets").unique())
    ).resolves.toBeNull();
  });

  it("rejects invalid buckets and count underflow", async () => {
    const t = convexTest(schema, convexModules);
    await expect(
      t.mutation((ctx) =>
        runConvexProgram(adjustArticleBucket(ctx, "en", "bad!", "article", 1))
      )
    ).rejects.toMatchObject({
      data: { code: "CONTENT_RELEASE_INTEGRITY" },
    });
    await expect(
      t.mutation((ctx) =>
        runConvexProgram(adjustArticleBucket(ctx, "en", "abc", "article", -1))
      )
    ).rejects.toMatchObject({
      data: { code: "CONTENT_RELEASE_INTEGRITY" },
    });
  });

  it("rejects a bucket before it exceeds its bounded sitemap page", async () => {
    const t = convexTest(schema, convexModules);
    await t.mutation((ctx) =>
      ctx.db.insert("articleBuckets", {
        articleCount: CONTENT_BUCKET_SIZE,
        bucket: "abc",
        categoryCount: 0,
        locale: "en",
      })
    );

    await expect(
      t.mutation((ctx) =>
        runConvexProgram(adjustArticleBucket(ctx, "en", "abc", "category", 1))
      )
    ).rejects.toMatchObject({
      data: { code: "CONTENT_RELEASE_LIMIT" },
    });
  });
});
