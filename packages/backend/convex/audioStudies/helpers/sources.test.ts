import {
  deleteAudioContentSource,
  getAudioContentSourceByLocale,
  getAudioContentSourceByRef,
  syncAudioContentSource,
} from "@repo/backend/convex/audioStudies/helpers/sources";
import schema from "@repo/backend/convex/schema";
import { convexModules } from "@repo/backend/convex/test.setup";
import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";

const articleSource = {
  contentHash: "article-hash",
  locale: "en" as const,
  slug: "articles/politics/dynastic-politics-asian-values",
  syncedAt: 1,
};

const localizedArticleSource = {
  contentHash: "artikel-hash",
  locale: "id" as const,
  slug: articleSource.slug,
  syncedAt: 1,
};

describe("audioStudies/helpers/sources", () => {
  it("syncs and reads compact audio metadata by ref and locale", async () => {
    const t = convexTest(schema, convexModules);

    const { englishId, indonesianId } = await t.mutation(async (ctx) => {
      const englishId = await ctx.db.insert("articleContents", {
        articleSlug: "dynastic-politics-asian-values",
        body: "English body",
        category: "politics",
        contentHash: articleSource.contentHash,
        date: 1,
        description: "English description",
        locale: articleSource.locale,
        slug: articleSource.slug,
        syncedAt: 1,
        title: "English title",
      });
      const indonesianId = await ctx.db.insert("articleContents", {
        articleSlug: "dynastic-politics-asian-values",
        body: "Indonesian body",
        category: "politics",
        contentHash: localizedArticleSource.contentHash,
        date: 1,
        description: "Indonesian description",
        locale: localizedArticleSource.locale,
        slug: localizedArticleSource.slug,
        syncedAt: 1,
        title: "Indonesian title",
      });

      await syncAudioContentSource(ctx, {
        ...articleSource,
        ref: { type: "article", id: englishId },
      });
      await syncAudioContentSource(ctx, {
        ...localizedArticleSource,
        ref: { type: "article", id: indonesianId },
      });

      return { englishId, indonesianId };
    });

    const result = await t.query(async (ctx) => {
      const english = await getAudioContentSourceByRef(ctx, {
        type: "article",
        id: englishId,
      });

      if (!english) {
        return null;
      }

      return {
        english,
        indonesian: await getAudioContentSourceByLocale(ctx, english, "id"),
      };
    });

    expect(result).toEqual({
      english: {
        contentHash: articleSource.contentHash,
        locale: articleSource.locale,
        ref: { type: "article", id: englishId },
        slug: articleSource.slug,
      },
      indonesian: {
        contentHash: localizedArticleSource.contentHash,
        locale: localizedArticleSource.locale,
        ref: { type: "article", id: indonesianId },
        slug: localizedArticleSource.slug,
      },
    });
  });

  it("updates and deletes compact audio metadata", async () => {
    const t = convexTest(schema, convexModules);

    const articleId = await t.mutation(async (ctx) => {
      const articleId = await ctx.db.insert("articleContents", {
        articleSlug: "dynastic-politics-asian-values",
        body: "English body",
        category: "politics",
        contentHash: articleSource.contentHash,
        date: 1,
        description: "English description",
        locale: articleSource.locale,
        slug: articleSource.slug,
        syncedAt: 1,
        title: "English title",
      });

      await syncAudioContentSource(ctx, {
        ...articleSource,
        ref: { type: "article", id: articleId },
      });
      await syncAudioContentSource(ctx, {
        ...articleSource,
        contentHash: "next-hash",
        ref: { type: "article", id: articleId },
        syncedAt: 2,
      });

      return articleId;
    });

    const updated = await t.query(
      async (ctx) =>
        await getAudioContentSourceByRef(ctx, {
          type: "article",
          id: articleId,
        })
    );

    await t.mutation(
      async (ctx) =>
        await deleteAudioContentSource(ctx, {
          type: "article",
          id: articleId,
        })
    );

    const deleted = await t.query(
      async (ctx) =>
        await getAudioContentSourceByRef(ctx, {
          type: "article",
          id: articleId,
        })
    );

    expect(updated).toEqual({
      contentHash: "next-hash",
      locale: articleSource.locale,
      ref: { type: "article", id: articleId },
      slug: articleSource.slug,
    });
    expect(deleted).toBeNull();
  });
});
