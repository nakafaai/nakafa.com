import { ACTIVE_APP_LOCALE_CODES } from "@nakafa/aksara-contracts/locale";
import { readAgentArticleTaxonomy } from "@repo/backend/convex/contentRelease/article/agent";
import { ARTICLE_AGENT_TAXONOMY_LIMIT } from "@repo/backend/convex/contentRelease/article/limits";
import { runConvexProgram } from "@repo/backend/convex/lib/effect";
import schema from "@repo/backend/convex/schema";
import { convexModules } from "@repo/backend/convex/test.setup";
import {
  insertRuntimeArticles,
  testArticleProjection,
  testLocalizedArticleProjection,
} from "@repo/backend/test/content-runtime";
import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";

describe("contentRelease/article/agent", () => {
  it("keeps agent taxonomy unmanaged before the article cutover", async () => {
    const target = convexTest(schema, convexModules);

    await expect(
      target.query((ctx) =>
        runConvexProgram(readAgentArticleTaxonomy(ctx, "en"))
      )
    ).resolves.toEqual({ categories: [], managed: false });
  });

  it.each(ACTIVE_APP_LOCALE_CODES)(
    "authenticates the complete %s article taxonomy",
    async (appLocale) => {
      const target = convexTest(schema, convexModules);
      const projection =
        appLocale === "en"
          ? testArticleProjection(0)
          : testLocalizedArticleProjection(0, appLocale);
      await target.mutation((ctx) =>
        insertRuntimeArticles(ctx, 1, () => projection)
      );

      await expect(
        target.query((ctx) =>
          runConvexProgram(readAgentArticleTaxonomy(ctx, appLocale))
        )
      ).resolves.toEqual({
        categories: [projection.category],
        managed: true,
      });
    }
  );

  it("accepts the exact category ceiling and fails closed above it", async () => {
    const target = convexTest(schema, convexModules);
    await target.mutation(async (ctx) => {
      await insertRuntimeArticles(ctx, 1);
      const source = await ctx.db.query("articleCategories").unique();
      if (!source) {
        expect.fail("Expected one active article category.");
      }
      for (let index = 1; index < ARTICLE_AGENT_TAXONOMY_LIMIT; index += 1) {
        await ctx.db.insert("articleCategories", {
          appLocale: source.appLocale,
          bucket: source.bucket,
          category: source.category,
          contentKey: source.contentKey,
          projectionHash: source.projectionHash,
          releaseId: source.releaseId,
          rendererDomain: source.rendererDomain,
          route: source.route,
          sequence: source.sequence,
          title: source.title,
        });
      }
    });

    const atLimit = await target.query((ctx) =>
      runConvexProgram(readAgentArticleTaxonomy(ctx, "en"))
    );
    expect(atLimit.managed).toBe(true);
    expect(atLimit.categories).toHaveLength(ARTICLE_AGENT_TAXONOMY_LIMIT);
    await target.mutation(async (ctx) => {
      const source = await ctx.db.query("articleCategories").first();
      if (!source) {
        expect.fail("Expected one active article category.");
      }
      await ctx.db.insert("articleCategories", {
        appLocale: source.appLocale,
        bucket: source.bucket,
        category: source.category,
        contentKey: source.contentKey,
        projectionHash: source.projectionHash,
        releaseId: source.releaseId,
        rendererDomain: source.rendererDomain,
        route: source.route,
        sequence: source.sequence,
        title: source.title,
      });
    });

    await expect(
      target.query((ctx) =>
        runConvexProgram(readAgentArticleTaxonomy(ctx, "en"))
      )
    ).rejects.toMatchObject({
      data: { code: "CONTENT_RELEASE_LIMIT" },
    });
  });
});
