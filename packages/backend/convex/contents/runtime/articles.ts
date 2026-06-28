import type { Doc } from "@repo/backend/convex/_generated/dataModel";
import type { QueryCtx } from "@repo/backend/convex/_generated/server";
import { CONTENT_SYNC_BATCH_LIMITS } from "@repo/backend/convex/contentSync/constants";
import {
  formatContentDate,
  getContentAuthors,
  throwRuntimeIntegrityError,
} from "@repo/backend/convex/contents/runtime/shared";
import type { Locale } from "@repo/backend/convex/lib/validators/contents";

/** Loads ordered article references within the sync reference limit. */
async function getArticleReferences(
  ctx: QueryCtx,
  articleId: Doc<"articleContents">["_id"]
) {
  const references = await ctx.db
    .query("articleReferences")
    .withIndex("by_articleId", (q) => q.eq("articleId", articleId))
    .take(CONTENT_SYNC_BATCH_LIMITS.articleReferences + 1);

  if (references.length > CONTENT_SYNC_BATCH_LIMITS.articleReferences) {
    throwRuntimeIntegrityError(
      "Article reference count exceeds the sync limit."
    );
  }

  return references
    .sort((left, right) => left.order - right.order)
    .map((reference) => ({
      authors: reference.authors,
      citation: reference.citation,
      details: reference.details,
      publication: reference.publication,
      title: reference.title,
      url: reference.url,
      year: reference.year,
    }));
}

/** Loads one article page from the durable content read model. */
export async function getArticlePageImpl(
  ctx: QueryCtx,
  args: {
    locale: Locale;
    slug: string;
  }
) {
  const article = await ctx.db
    .query("articleContents")
    .withIndex("by_locale_and_slug", (q) =>
      q.eq("locale", args.locale).eq("slug", args.slug)
    )
    .unique();

  if (!article) {
    return null;
  }

  const [authors, references] = await Promise.all([
    getContentAuthors(ctx, {
      contentId: article._id,
      contentType: "article",
    }),
    getArticleReferences(ctx, article._id),
  ]);

  return {
    articleSlug: article.articleSlug,
    body: article.body,
    category: article.category,
    contentHash: article.contentHash,
    metadata: {
      authors,
      date: formatContentDate(article.date),
      description: article.description,
      title: article.title,
    },
    references,
    slug: article.slug,
    syncedAt: article.syncedAt,
  };
}
