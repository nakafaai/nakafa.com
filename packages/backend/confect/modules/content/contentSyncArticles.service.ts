import type { Id } from "@repo/backend/confect/_generated/dataModel";
import {
  DatabaseReader,
  DatabaseWriter,
} from "@repo/backend/confect/_generated/services";
import { CONTENT_SYNC_BATCH_LIMITS } from "@repo/backend/confect/modules/content/constants";
import type {
  ArticleCategory,
  Locale,
} from "@repo/backend/confect/modules/content/content.schemas";
import { buildContentSearchRef } from "@repo/backend/confect/modules/content/contentSearch/documents.service";
import {
  deleteContentSearch,
  syncContentSearch,
} from "@repo/backend/confect/modules/content/contentSearch/writes.service";
import { assertContentSyncBatchSize } from "@repo/backend/confect/modules/content/contentSync.shared";
import {
  buildAuthorCache,
  deleteArticleReferencesForArticle,
  deleteContentAuthorLinks,
  replaceArticleReferences,
  resetAudioForContentHash,
  syncContentAuthorsWithCache,
} from "@repo/backend/confect/modules/content/contentSyncHelpers.service";
import { Clock, Effect, Option } from "effect";

interface SyncedArticleReference {
  readonly authors: string;
  readonly citation?: string;
  readonly details?: string;
  readonly publication?: string;
  readonly title: string;
  readonly url?: string;
  readonly year: number;
}

interface SyncedArticle {
  readonly articleSlug: string;
  readonly authors: readonly { readonly name: string }[];
  readonly body: string;
  readonly category: ArticleCategory;
  readonly contentHash: string;
  readonly date: number;
  readonly description?: string;
  readonly locale: Locale;
  readonly references: readonly SyncedArticleReference[];
  readonly slug: string;
  readonly title: string;
}

/** Upserts article content, references, authors, search, and audio invalidation. */
export const bulkSyncArticles = Effect.fn(
  "contentSync.articles.bulkSyncArticles"
)(function* (args: { articles: SyncedArticle[] }) {
  const reader = yield* DatabaseReader;
  const writer = yield* DatabaseWriter;
  yield* assertContentSyncBatchSize({
    functionName: "bulkSyncArticles",
    limit: CONTENT_SYNC_BATCH_LIMITS.articles,
    received: args.articles.length,
    unit: "articles",
  });

  const now = yield* Clock.currentTimeMillis;
  let authorLinksCreated = 0;
  let created = 0;
  let referencesCreated = 0;
  let unchanged = 0;
  let updated = 0;
  const allAuthorNames = args.articles.flatMap((article) =>
    article.authors.map((author) => author.name)
  );
  const authorCache = yield* buildAuthorCache(allAuthorNames);

  for (const article of args.articles) {
    const existingArticle = yield* reader
      .table("articleContents")
      .index("by_locale_and_slug", (query) =>
        query.eq("locale", article.locale).eq("slug", article.slug)
      )
      .first()
      .pipe(Effect.map(Option.getOrNull));
    yield* syncContentSearch({
      contentHash: article.contentHash,
      description: article.description,
      locale: article.locale,
      route: article.slug,
      section: "articles",
      syncedAt: now,
      text: article.body,
      title: article.title,
    });

    if (existingArticle?.contentHash === article.contentHash) {
      unchanged += 1;
      continue;
    }

    if (existingArticle) {
      yield* writer.table("articleContents").patch(existingArticle._id, {
        articleSlug: article.articleSlug,
        body: article.body,
        category: article.category,
        contentHash: article.contentHash,
        date: article.date,
        description: article.description,
        syncedAt: now,
        title: article.title,
      });
      yield* resetAudioForContentHash({
        contentRef: { id: existingArticle._id, type: "article" },
        newHash: article.contentHash,
      });
      authorLinksCreated += yield* syncContentAuthorsWithCache(
        existingArticle._id,
        "article",
        article.authors,
        authorCache
      );
      referencesCreated += yield* replaceArticleReferences(
        existingArticle._id,
        article.references
      );
      updated += 1;
      continue;
    }

    const articleId = yield* writer.table("articleContents").insert({
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
    authorLinksCreated += yield* syncContentAuthorsWithCache(
      articleId,
      "article",
      article.authors,
      authorCache
    );
    referencesCreated += yield* replaceArticleReferences(
      articleId,
      article.references
    );
    created += 1;
  }

  return { authorLinksCreated, created, referencesCreated, unchanged, updated };
});

/** Deletes stale articles and their linked read models. */
export const deleteStaleArticles = Effect.fn(
  "contentSync.articles.deleteStaleArticles"
)(function* (args: { articleIds: Id<"articleContents">[] }) {
  const reader = yield* DatabaseReader;
  const writer = yield* DatabaseWriter;
  yield* assertContentSyncBatchSize({
    functionName: "deleteStaleArticles",
    limit: CONTENT_SYNC_BATCH_LIMITS.staleArticles,
    received: args.articleIds.length,
    unit: "article IDs",
  });

  if (args.articleIds.length === 0) {
    return { deleted: 0 };
  }

  let deleted = 0;

  for (const articleId of args.articleIds) {
    const article = yield* reader
      .table("articleContents")
      .get(articleId)
      .pipe(Effect.catchTag("GetByIdFailure", () => Effect.succeed(null)));

    if (!article) {
      continue;
    }

    const searchRef = buildContentSearchRef({
      locale: article.locale,
      route: article.slug,
      section: "articles",
    });
    yield* deleteContentAuthorLinks(articleId, "article");
    yield* deleteArticleReferencesForArticle(articleId);
    yield* deleteContentSearch(searchRef.content_id);
    yield* writer.table("articleContents").delete(articleId);
    deleted += 1;
  }

  return { deleted };
});
