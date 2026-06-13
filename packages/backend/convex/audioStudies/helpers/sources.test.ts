import {
  deleteAudioContentSource,
  getAudioContentSourceByContentId,
  getAudioContentSourceByLocale,
  syncAudioContentSource,
} from "@repo/backend/convex/audioStudies/helpers/sources";
import schema from "@repo/backend/convex/schema";
import { getTestAudioContent } from "@repo/backend/convex/test.helpers";
import { convexModules } from "@repo/backend/convex/test.setup";
import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";

const articleSource = getTestAudioContent({
  contentHash: "article-hash",
  locale: "en",
  route: "articles/politics/dynastic-politics-asian-values",
});

const localizedArticleSource = getTestAudioContent({
  contentHash: "artikel-hash",
  locale: "id",
  route: articleSource.route,
});

describe("audioStudies/helpers/sources", () => {
  it("syncs and reads compact audio metadata by graph content ID and locale", async () => {
    const t = convexTest(schema, convexModules);

    await t.mutation(async (ctx) => {
      await syncAudioContentSource(ctx, {
        ...articleSource,
        syncedAt: 1,
      });
      await syncAudioContentSource(ctx, {
        ...localizedArticleSource,
        syncedAt: 1,
      });
    });

    const result = await t.query(async (ctx) => {
      const english = await getAudioContentSourceByContentId(
        ctx,
        articleSource.content_id
      );

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
        alignmentId: articleSource.alignmentId,
        assetId: articleSource.assetId,
        conceptId: articleSource.conceptId,
        contentHash: articleSource.contentHash,
        content_id: articleSource.content_id,
        contentType: articleSource.contentType,
        learningObjectId: articleSource.learningObjectId,
        lensId: articleSource.lensId,
        locale: articleSource.locale,
        route: articleSource.route,
      },
      indonesian: {
        alignmentId: localizedArticleSource.alignmentId,
        assetId: localizedArticleSource.assetId,
        conceptId: localizedArticleSource.conceptId,
        contentHash: localizedArticleSource.contentHash,
        content_id: localizedArticleSource.content_id,
        contentType: localizedArticleSource.contentType,
        learningObjectId: localizedArticleSource.learningObjectId,
        lensId: localizedArticleSource.lensId,
        locale: localizedArticleSource.locale,
        route: localizedArticleSource.route,
      },
    });
  });

  it("updates and deletes compact audio metadata", async () => {
    const t = convexTest(schema, convexModules);

    await t.mutation(async (ctx) => {
      await syncAudioContentSource(ctx, {
        ...articleSource,
        syncedAt: 1,
      });
      await syncAudioContentSource(ctx, {
        ...articleSource,
        contentHash: "next-hash",
        syncedAt: 2,
      });
    });

    const updated = await t.query(
      async (ctx) =>
        await getAudioContentSourceByContentId(ctx, articleSource.content_id)
    );

    await t.mutation(
      async (ctx) =>
        await deleteAudioContentSource(ctx, articleSource.content_id)
    );

    const deleted = await t.query(
      async (ctx) =>
        await getAudioContentSourceByContentId(ctx, articleSource.content_id)
    );

    expect(updated).toEqual({
      alignmentId: articleSource.alignmentId,
      assetId: articleSource.assetId,
      conceptId: articleSource.conceptId,
      contentHash: "next-hash",
      content_id: articleSource.content_id,
      contentType: articleSource.contentType,
      learningObjectId: articleSource.learningObjectId,
      lensId: articleSource.lensId,
      locale: articleSource.locale,
      route: articleSource.route,
    });
    expect(deleted).toBeNull();
  });
});
