import {
  ARTICLE_BUCKET_SIZE,
  adjustArticleBucket,
  getArticleBucket,
  isArticleBucket,
} from "@repo/backend/convex/contentRelease/article/bucket";
import { runConvexProgram } from "@repo/backend/convex/lib/effect";
import schema from "@repo/backend/convex/schema";
import { convexModules } from "@repo/backend/convex/test.setup";
import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";

describe("contentRelease/article/bucket", () => {
  it("derives only canonical projection-hash buckets", () => {
    expect(getArticleBucket(`sha256:${"a".repeat(64)}`)).toBe("aaa");
    expect(getArticleBucket("digest")).toBeNull();
    expect(getArticleBucket("sha256:no")).toBeNull();
    expect(isArticleBucket("09f")).toBe(true);
    expect(isArticleBucket("09F")).toBe(false);
  });

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
        articleCount: ARTICLE_BUCKET_SIZE,
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
