import { updateContentHash } from "@repo/backend/convex/audioStudies/utils";
import { CONTENT_SYNC_BATCH_LIMITS } from "@repo/backend/convex/contentSync/constants";
import { assertContentSyncBatchSize } from "@repo/backend/convex/contentSync/lib/errors";
import {
  buildAuthorCache,
  deleteArticleReferencesForArticle,
  deleteContentAuthorLinks,
  replaceArticleReferences,
  syncContentAuthorsWithCache,
} from "@repo/backend/convex/contentSync/lib/syncHelpers";
import { internalMutation } from "@repo/backend/convex/functions";
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

export const bulkSyncArticles = internalMutation({
  args: {
    articles: v.array(syncedArticleValidator),
  },
  returns: bulkSyncArticlesResultValidator,
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

      if (existingArticle?.contentHash === article.contentHash) {
        unchanged++;
        continue;
      }

      if (existingArticle) {
        await ctx.db.patch("articleContents", existingArticle._id, {
          articleSlug: article.articleSlug,
          body: article.body,
          category: article.category,
          contentHash: article.contentHash,
          date: article.date,
          description: article.description,
          syncedAt: now,
          title: article.title,
        });

        await updateContentHash(
          ctx,
          { id: existingArticle._id, type: "article" },
          article.contentHash
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
        articleSlug: article.articleSlug,
        body: article.body,
        category: article.category,
        contentHash: article.contentHash,
        date: article.date,
        description: article.description,
        locale: article.locale,
        slug: article.slug,
        syncedAt: now,
        title: article.title,
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

      await deleteContentAuthorLinks(ctx, articleId, "article");
      await deleteArticleReferencesForArticle(ctx, articleId);
      await ctx.db.delete("articleContents", articleId);
      deleted++;
    }

    return { deleted };
  },
});
