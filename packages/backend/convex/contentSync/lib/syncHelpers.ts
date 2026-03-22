import type { Id } from "@repo/backend/convex/_generated/dataModel";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import type { ContentAuthorContentId } from "@repo/backend/convex/authors/schema";
import { CONTENT_SYNC_BATCH_LIMITS } from "@repo/backend/convex/contentSync/constants";
import type {
  ContentType,
  Locale,
} from "@repo/backend/convex/lib/validators/contents";
import { ConvexError } from "convex/values";

export type AuthorCache = Map<string, Id<"authors">>;

export interface SyncedAuthor {
  name: string;
}

export interface SyncedArticleReference {
  authors: string;
  citation?: string;
  details?: string;
  publication?: string;
  title: string;
  url?: string;
  year: number;
}

export interface SyncedExerciseChoice {
  isCorrect: boolean;
  label: string;
  optionKey: string;
  order: number;
}

export async function buildAuthorCache(
  ctx: MutationCtx,
  authorNames: string[]
): Promise<AuthorCache> {
  const cache: AuthorCache = new Map();
  const uniqueNames = [...new Set(authorNames)];

  const results = await Promise.all(
    uniqueNames.map((name) =>
      ctx.db
        .query("authors")
        .withIndex("name", (q) => q.eq("name", name))
        .unique()
        .then((author) => ({ author, name }))
    )
  );

  for (const { author, name } of results) {
    if (!author) {
      continue;
    }

    cache.set(name, author._id);
  }

  return cache;
}

export async function syncContentAuthorsWithCache(
  ctx: MutationCtx,
  contentId: ContentAuthorContentId,
  contentType: ContentType,
  authors: SyncedAuthor[],
  authorCache: AuthorCache
): Promise<number> {
  const missingAuthorNames = authors.flatMap((author) => {
    if (authorCache.has(author.name)) {
      return [];
    }

    return [author.name];
  });

  if (missingAuthorNames.length > 0) {
    throw new ConvexError({
      code: "CONTENT_SYNC_MISSING_AUTHORS",
      message: `Missing author(s) for ${contentType} ${contentId}: ${missingAuthorNames.join(", ")}. Run bulkSyncAuthors first.`,
    });
  }

  await deleteContentAuthorLinks(ctx, contentId, contentType);

  let linksCreated = 0;

  for (const [order, author] of authors.entries()) {
    const authorId = authorCache.get(author.name);

    if (!authorId) {
      throw new ConvexError({
        code: "CONTENT_SYNC_AUTHOR_CACHE_MISS",
        message: `Missing author cache entry for ${author.name}.`,
      });
    }

    await ctx.db.insert("contentAuthors", {
      authorId,
      contentId,
      contentType,
      order,
    });
    linksCreated++;
  }

  return linksCreated;
}

export async function replaceArticleReferences(
  ctx: MutationCtx,
  articleId: Id<"articleContents">,
  references: SyncedArticleReference[]
): Promise<number> {
  await deleteArticleReferencesForArticle(ctx, articleId);

  let created = 0;

  for (const [order, reference] of references.entries()) {
    await ctx.db.insert("articleReferences", {
      articleId,
      authors: reference.authors,
      citation: reference.citation,
      details: reference.details,
      order,
      publication: reference.publication,
      title: reference.title,
      url: reference.url,
      year: reference.year,
    });
    created++;
  }

  return created;
}

export async function replaceExerciseChoices(
  ctx: MutationCtx,
  args: {
    choices: SyncedExerciseChoice[];
    locale: Locale;
    questionId: Id<"exerciseQuestions">;
  }
): Promise<number> {
  await deleteExerciseChoicesForQuestion(ctx, args.questionId);

  let created = 0;

  for (const choice of args.choices) {
    await ctx.db.insert("exerciseChoices", {
      isCorrect: choice.isCorrect,
      label: choice.label,
      locale: args.locale,
      optionKey: choice.optionKey,
      order: choice.order,
      questionId: args.questionId,
    });
    created++;
  }

  return created;
}

export async function deleteContentAuthorLinks(
  ctx: MutationCtx,
  contentId: ContentAuthorContentId,
  contentType: ContentType
) {
  while (true) {
    const existingLinks = await ctx.db
      .query("contentAuthors")
      .withIndex("contentId_contentType_authorId", (q) =>
        q.eq("contentId", contentId).eq("contentType", contentType)
      )
      .take(CONTENT_SYNC_BATCH_LIMITS.authors);

    if (existingLinks.length === 0) {
      return;
    }

    for (const link of existingLinks) {
      await ctx.db.delete("contentAuthors", link._id);
    }
  }
}

export async function deleteArticleReferencesForArticle(
  ctx: MutationCtx,
  articleId: Id<"articleContents">
) {
  while (true) {
    const existingReferences = await ctx.db
      .query("articleReferences")
      .withIndex("articleId", (q) => q.eq("articleId", articleId))
      .take(CONTENT_SYNC_BATCH_LIMITS.articleReferences);

    if (existingReferences.length === 0) {
      return;
    }

    for (const reference of existingReferences) {
      await ctx.db.delete("articleReferences", reference._id);
    }
  }
}

export async function deleteExerciseChoicesForQuestion(
  ctx: MutationCtx,
  questionId: Id<"exerciseQuestions">
) {
  while (true) {
    const existingChoices = await ctx.db
      .query("exerciseChoices")
      .withIndex("questionId_locale", (q) => q.eq("questionId", questionId))
      .take(CONTENT_SYNC_BATCH_LIMITS.exerciseChoices);

    if (existingChoices.length === 0) {
      return;
    }

    for (const choice of existingChoices) {
      await ctx.db.delete("exerciseChoices", choice._id);
    }
  }
}
