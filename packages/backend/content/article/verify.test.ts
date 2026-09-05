import { describe, expect, it } from "@effect/vitest";
import { convexArticleLayer } from "@repo/backend/content/article/convex";
import {
  verifyArticle,
  verifyCategory,
} from "@repo/backend/content/article/verify";
import { runConvexProgram } from "@repo/backend/convex/lib/effect";
import schema from "@repo/backend/convex/schema";
import { convexModules } from "@repo/backend/convex/test.setup";
import { insertRuntimeArticles } from "@repo/backend/test/content/runtime";
import { convexTest } from "convex-test";
import { Effect } from "effect";

describe("contentRelease/article/verify", () => {
  it("accepts the signed asset identity and rejects a stored mismatch", async () => {
    const target = convexTest(schema, convexModules);
    await target.mutation((ctx) => insertRuntimeArticles(ctx, 1));

    await expect(
      target.query(async (ctx) => {
        const row = await ctx.db.query("articleCatalog").unique();
        if (!row) {
          throw new Error("Expected one active article row.");
        }
        return runConvexProgram(
          verifyArticle(row, row.sequence).pipe(
            Effect.provide(convexArticleLayer(ctx))
          )
        );
      })
    ).resolves.toMatchObject({ projection: { kind: "article" } });

    await target.mutation(async (ctx) => {
      const row = await ctx.db.query("articleCatalog").unique();
      if (!row) {
        throw new Error("Expected one active article row.");
      }
      await ctx.db.patch("articleCatalog", row._id, {
        assetId: "asset:en:article:politics:article:politics:wrong",
      });
    });
    await expect(
      target.query(async (ctx) => {
        const row = await ctx.db.query("articleCatalog").unique();
        if (!row) {
          throw new Error("Expected one active article row.");
        }
        return runConvexProgram(
          verifyArticle(row, row.sequence).pipe(
            Effect.provide(convexArticleLayer(ctx))
          )
        );
      })
    ).rejects.toMatchObject({
      data: { code: "CONTENT_RELEASE_INTEGRITY" },
    });
  });

  it("rejects a category route that contradicts its signed representative", async () => {
    const target = convexTest(schema, convexModules);
    await target.mutation((ctx) => insertRuntimeArticles(ctx, 1));
    await target.mutation(async (ctx) => {
      const category = await ctx.db.query("articleCategories").unique();
      if (!category) {
        throw new Error("Expected one active article category.");
      }
      await ctx.db.patch("articleCategories", category._id, {
        route: "government",
      });
    });

    await expect(
      target.query(async (ctx) => {
        const category = await ctx.db.query("articleCategories").unique();
        if (!category) {
          throw new Error("Expected one active article category.");
        }
        return runConvexProgram(
          verifyCategory(category, category.sequence).pipe(
            Effect.provide(convexArticleLayer(ctx))
          )
        );
      })
    ).rejects.toMatchObject({
      data: { code: "CONTENT_RELEASE_INTEGRITY" },
    });
  });
});
