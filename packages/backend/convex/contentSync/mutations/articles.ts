import { updateContentAudioHash } from "@repo/backend/convex/audioStudies/contentAudios/impl";
import {
  deleteAudioContentSource,
  syncAudioContentSource,
} from "@repo/backend/convex/audioStudies/helpers/sources";
import { CONTENT_SYNC_BATCH_LIMITS } from "@repo/backend/convex/contentSync/constants";
import { assertContentSyncBatchSize } from "@repo/backend/convex/contentSync/lib/errors";
import {
  buildAuthorCache,
  deleteArticleReferencesForArticle,
  deleteContentAuthorLinks,
  replaceArticleReferences,
  syncContentAuthorsWithCache,
} from "@repo/backend/convex/contentSync/lib/syncHelpers";
import { hasSameSyncValues } from "@repo/backend/convex/contentSync/lib/syncValues";
import {
  deleteContentRoute,
  syncContentRoute,
} from "@repo/backend/convex/contents/helpers/routes/write";
import { buildContentSearchRef } from "@repo/backend/convex/contents/helpers/search/documents";
import {
  deleteContentSearch,
  syncContentSearch,
} from "@repo/backend/convex/contents/helpers/search/write";
import { internalMutation } from "@repo/backend/convex/functions";
import { runConvexProgram } from "@repo/backend/convex/lib/effect";
import {
  articleCategoryValidator,
  localeValidator,
} from "@repo/backend/convex/lib/validators/contents";
import { v } from "convex/values";
import { getAll } from "convex-helpers/server/relationships";

const syncedArticleReferenceValidator = v.object({
  authors: v.string(),
  citation: v.optional(v.string()),
  details: v.optional(v.string()),
  publication: v.optional(v.string()),
  title: v.string(),
  url: v.optional(v.string()),
  year: v.number(),
});

const syncedArticleValidator = v.object({
  articleSlug: v.string(),
  authors: v.array(v.object({ name: v.string() })),
  body: v.string(),
  category: articleCategoryValidator,
  contentHash: v.string(),
  date: v.number(),
  description: v.optional(v.string()),
  locale: localeValidator,
  official: v.boolean(),
  references: v.array(syncedArticleReferenceValidator),
  slug: v.string(),
  title: v.string(),
});

const bulkSyncArticlesResultValidator = v.object({
  authorLinksCreated: v.number(),
  created: v.number(),
  referencesCreated: v.number(),
  unchanged: v.number(),
  updated: v.number(),
});

const deleteResultValidator = v.object({
  deleted: v.number(),
});

/** Upsert article rows, references, author links, search, and audio sources. */
export const bulkSyncArticles = internalMutation({
  args: {
    articles: v.array(syncedArticleValidator),
  },
  returns: bulkSyncArticlesResultValidator,
  /** Applies one bounded article sync batch to runtime, search, author, reference, and audio rows. */
  handler: async (ctx, args) => {
    assertContentSyncBatchSize({
      functionName: "bulkSyncArticles",
      limit: CONTENT_SYNC_BATCH_LIMITS.articles,
      received: args.articles.length,
      unit: "articles",
    });

    const now = Date.now();
    let authorLinksCreated = 0;
    let created = 0;
    let referencesCreated = 0;
    let unchanged = 0;
    let updated = 0;

    const allAuthorNames = args.articles.flatMap((article) =>
      article.authors.map((author) => author.name)
    );
    const authorCache = await buildAuthorCache(ctx, allAuthorNames);

    for (const article of args.articles) {
      const existingArticle = await ctx.db
        .query("articleContents")
        .withIndex("by_locale_and_slug", (q) =>
          q.eq("locale", article.locale).eq("slug", article.slug)
        )
        .unique();

      await syncContentSearch(ctx, {
        contentHash: article.contentHash,
        description: article.description,
        locale: article.locale,
        route: article.slug,
        section: "articles",
        syncedAt: now,
        text: article.body,
        title: article.title,
      });
      await syncContentRoute(ctx, {
        authors: article.authors,
        contentHash: article.contentHash,
        date: article.date,
        description: article.description,
        kind: "article",
        locale: article.locale,
        markdown: true,
        official: article.official,
        route: article.slug,
        section: "articles",
        syncedAt: now,
        title: article.title,
      });

      if (existingArticle) {
        await syncAudioContentSource(ctx, {
          contentHash: article.contentHash,
          locale: article.locale,
          ref: { id: existingArticle._id, type: "article" },
          slug: article.slug,
          syncedAt: now,
        });
      }

      const nextValues = {
        articleSlug: article.articleSlug,
        body: article.body,
        category: article.category,
        contentHash: article.contentHash,
        date: article.date,
        description: article.description,
        title: article.title,
      };

      if (hasSameSyncValues(nextValues, existingArticle)) {
        unchanged++;
        continue;
      }

      if (existingArticle) {
        await ctx.db.patch("articleContents", existingArticle._id, {
          ...nextValues,
          syncedAt: now,
        });

        await runConvexProgram(
          updateContentAudioHash(ctx, {
            contentRef: { id: existingArticle._id, type: "article" },
            newHash: article.contentHash,
          })
        );

        authorLinksCreated += await syncContentAuthorsWithCache(
          ctx,
          existingArticle._id,
          "article",
          article.authors,
          authorCache
        );
        referencesCreated += await replaceArticleReferences(
          ctx,
          existingArticle._id,
          article.references
        );

        updated++;
        continue;
      }

      const articleId = await ctx.db.insert("articleContents", {
        ...nextValues,
        locale: article.locale,
        slug: article.slug,
        syncedAt: now,
      });

      await syncAudioContentSource(ctx, {
        contentHash: article.contentHash,
        locale: article.locale,
        ref: { id: articleId, type: "article" },
        slug: article.slug,
        syncedAt: now,
      });

      authorLinksCreated += await syncContentAuthorsWithCache(
        ctx,
        articleId,
        "article",
        article.authors,
        authorCache
      );
      referencesCreated += await replaceArticleReferences(
        ctx,
        articleId,
        article.references
      );

      created++;
    }

    return {
      authorLinksCreated,
      created,
      referencesCreated,
      unchanged,
      updated,
    };
  },
});

export const deleteStaleArticles = internalMutation({
  args: {
    articleIds: v.array(v.id("articleContents")),
  },
  returns: deleteResultValidator,
  /** Removes one bounded stale article batch and its sync-owned dependent rows. */
  handler: async (ctx, args) => {
    assertContentSyncBatchSize({
      functionName: "deleteStaleArticles",
      limit: CONTENT_SYNC_BATCH_LIMITS.staleArticles,
      received: args.articleIds.length,
      unit: "article IDs",
    });

    if (args.articleIds.length === 0) {
      return { deleted: 0 };
    }

    const articles = await getAll(ctx.db, args.articleIds);
    let deleted = 0;

    for (const [index, article] of articles.entries()) {
      if (!article) {
        continue;
      }

      const articleId = args.articleIds[index];
      const searchRef = buildContentSearchRef({
        locale: article.locale,
        route: article.slug,
        section: "articles",
      });

      await deleteContentAuthorLinks(ctx, articleId, "article");
      await deleteArticleReferencesForArticle(ctx, articleId);
      await deleteContentSearch(ctx, searchRef.content_id);
      await deleteContentRoute(ctx, searchRef.content_id);
      await deleteAudioContentSource(ctx, { id: articleId, type: "article" });
      await ctx.db.delete("articleContents", articleId);
      deleted++;
    }

    return { deleted };
  },
});
