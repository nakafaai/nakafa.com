import {
  deleteAudioContentSourceByRoute,
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

const conflictingArticleSource = {
  ...articleSource,
  alignmentId: `${articleSource.alignmentId}:conflict`,
  assetId: `${articleSource.assetId}:conflict`,
  conceptId: `${articleSource.conceptId}:conflict`,
  contentHash: "conflicting-hash",
  content_id: `${articleSource.content_id}:conflict`,
  learningObjectId: `${articleSource.learningObjectId}:conflict`,
  lensId: `${articleSource.lensId}:conflict`,
};

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

  it("updates compact audio metadata", async () => {
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
  });

  it("rejects a route owned by another content ID without changing it", async () => {
    const t = convexTest(schema, convexModules);

    await t.mutation(async (ctx) => {
      await syncAudioContentSource(ctx, {
        ...conflictingArticleSource,
        syncedAt: 1,
      });
    });

    await expect(
      t.mutation(async (ctx) =>
        syncAudioContentSource(ctx, {
          ...articleSource,
          syncedAt: 2,
        })
      )
    ).rejects.toMatchObject({
      data: { code: "AUDIO_CONTENT_SOURCE_ROUTE_COLLISION" },
    });

    const snapshot = await t.query(async (ctx) => {
      const canonical = await getAudioContentSourceByContentId(
        ctx,
        articleSource.content_id
      );
      const conflicting = await getAudioContentSourceByContentId(
        ctx,
        conflictingArticleSource.content_id
      );
      const routeRows = await ctx.db
        .query("audioContentSources")
        .withIndex("by_contentType_and_route_and_locale", (q) =>
          q
            .eq("contentType", articleSource.contentType)
            .eq("route", articleSource.route)
            .eq("locale", articleSource.locale)
        )
        .collect();

      return { canonical, conflicting, routeRows };
    });

    expect(snapshot.canonical).toBeNull();
    expect(snapshot.conflicting).toMatchObject({
      contentHash: conflictingArticleSource.contentHash,
      content_id: conflictingArticleSource.content_id,
    });
    expect(snapshot.routeRows).toHaveLength(1);
    expect(snapshot.routeRows[0]).toMatchObject({
      contentHash: conflictingArticleSource.contentHash,
      content_id: conflictingArticleSource.content_id,
      route: articleSource.route,
    });
  });

  it("rejects duplicate content IDs without changing either row", async () => {
    const t = convexTest(schema, convexModules);

    await t.mutation(async (ctx) => {
      await ctx.db.insert("audioContentSources", {
        ...articleSource,
        syncedAt: 1,
      });
      await ctx.db.insert("audioContentSources", {
        ...articleSource,
        route: `${articleSource.route}/duplicate`,
        syncedAt: 1,
      });
    });

    await expect(
      t.mutation(async (ctx) =>
        syncAudioContentSource(ctx, {
          ...articleSource,
          syncedAt: 2,
        })
      )
    ).rejects.toMatchObject({
      data: { code: "AUDIO_CONTENT_SOURCE_IDENTITY_COLLISION" },
    });

    const rows = await t.query(
      async (ctx) =>
        await ctx.db
          .query("audioContentSources")
          .withIndex("by_content_id", (q) =>
            q.eq("content_id", articleSource.content_id)
          )
          .collect()
    );

    expect(rows).toHaveLength(2);
    expect(rows.map((row) => row.route)).toEqual(
      expect.arrayContaining([
        articleSource.route,
        `${articleSource.route}/duplicate`,
      ])
    );
  });

  it("rejects deleting a duplicated route without deleting either row", async () => {
    const t = convexTest(schema, convexModules);

    await t.mutation(async (ctx) => {
      await ctx.db.insert("audioContentSources", {
        ...articleSource,
        syncedAt: 1,
      });
      await ctx.db.insert("audioContentSources", {
        ...conflictingArticleSource,
        syncedAt: 1,
      });
    });

    await expect(
      t.mutation(async (ctx) =>
        deleteAudioContentSourceByRoute(ctx, articleSource)
      )
    ).rejects.toMatchObject({
      data: { code: "AUDIO_CONTENT_SOURCE_ROUTE_COLLISION" },
    });

    const rows = await t.query(
      async (ctx) =>
        await ctx.db
          .query("audioContentSources")
          .withIndex("by_contentType_and_route_and_locale", (q) =>
            q
              .eq("contentType", articleSource.contentType)
              .eq("route", articleSource.route)
              .eq("locale", articleSource.locale)
          )
          .collect()
    );

    expect(rows).toHaveLength(2);
    expect(rows.map((row) => row.content_id)).toEqual(
      expect.arrayContaining([
        articleSource.content_id,
        conflictingArticleSource.content_id,
      ])
    );
  });
});
