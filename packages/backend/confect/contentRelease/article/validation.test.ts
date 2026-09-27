import { assert, describe, expect, it } from "@effect/vitest";
import { validateArticleModel } from "@repo/backend/confect/contentRelease/article/validation";
import { writeArticle } from "@repo/backend/confect/contentRelease/article/write";
import { RELEASE_PAGE_LIMIT } from "@repo/backend/confect/contentRelease/spec";
import { runConvexProgram } from "@repo/backend/confect/runtime";
import { convexModules } from "@repo/backend/confect/test.setup";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import schema from "@repo/backend/convex/schema";
import {
  categorizedArticle,
  insertArticleProjection,
} from "@repo/backend/test/article/release";
import type { TestIdentity } from "@repo/backend/test/content/state";
import { convexTest } from "convex-test";

const RELEASE = {
  manifestHash: `sha256:${"5".repeat(64)}`,
  releaseId: "release-article-validation",
  sequence: 1,
} satisfies TestIdentity;

/** Writes a full catalog page with shared category claims and one lookahead. */
async function insertCatalog(ctx: MutationCtx) {
  for (let index = 0; index <= RELEASE_PAGE_LIMIT; index += 1) {
    const suffix = Math.floor(index / 2)
      .toString()
      .padStart(3, "0");
    const projection = categorizedArticle({
      article: index,
      category: `topic-${suffix}`,
      route: `topic-${suffix}`,
      title: `Topic ${suffix}`,
    });
    await insertArticleProjection(ctx, RELEASE, index, projection);
    const head = await ctx.db
      .query("contentHeads")
      .withIndex("by_contentKey_and_artifactLocale_and_sequence", (q) =>
        q
          .eq("contentKey", projection.contentKey)
          .eq("artifactLocale", projection.artifactLocale)
          .eq("sequence", RELEASE.sequence)
      )
      .unique();
    assert(head);
    await runConvexProgram(writeArticle(ctx, "blue", head, projection));
  }
}

describe("contentRelease/article/validation", () => {
  it("validates bounded pages and shares each category claim across its articles", async () => {
    const t = convexTest(schema, convexModules);
    await t.mutation(insertCatalog);

    const first = await t.mutation((ctx) =>
      runConvexProgram(validateArticleModel(ctx, "blue", undefined, 1))
    );
    expect(first).toMatchObject({
      cursor: expect.any(String),
      done: false,
      processed: RELEASE_PAGE_LIMIT,
    });
    await expect(
      t.mutation((ctx) =>
        runConvexProgram(validateArticleModel(ctx, "blue", first.cursor, 1))
      )
    ).resolves.toMatchObject({ done: true, processed: 1 });
  });
  it.each(["missing", "route"])(
    "rejects a %s category owner without changing the model",
    async (drift) => {
      const t = convexTest(schema, convexModules);
      await t.mutation(insertCatalog);
      await t.mutation(async (ctx) => {
        const category = await ctx.db.query("articleCategories").first();
        assert(category);
        if (drift === "missing") {
          await ctx.db.delete("articleCategories", category._id);
        } else {
          await ctx.db.patch("articleCategories", category._id, {
            route: "different-category",
          });
        }
      });
      const readModel = () =>
        t.query(async (ctx) => ({
          categories: await ctx.db.query("articleCategories").collect(),
          catalog: await ctx.db.query("articleCatalog").collect(),
        }));
      const before = await readModel();
      await expect(
        t.mutation((ctx) =>
          runConvexProgram(validateArticleModel(ctx, "blue", undefined, 1))
        )
      ).rejects.toMatchObject({ data: { code: "CONTENT_RELEASE_INTEGRITY" } });
      expect(await readModel()).toEqual(before);
    }
  );
});
