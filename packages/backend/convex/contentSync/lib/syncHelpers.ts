import type { Id } from "@repo/backend/convex/_generated/dataModel";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import { deleteAudioContentSourceByRoute } from "@repo/backend/convex/audioStudies/helpers/sources";
import type { ContentAuthorContentId } from "@repo/backend/convex/authors/schema";
import { CONTENT_SYNC_BATCH_LIMITS } from "@repo/backend/convex/contentSync/constants";
import { assertContentSyncBatchSize } from "@repo/backend/convex/contentSync/lib/errors";
import { deleteContentRoutesBySourcePath } from "@repo/backend/convex/contents/helpers/routes/write";
import { deleteContentSearchBySourcePath } from "@repo/backend/convex/contents/helpers/search/write";
import {
  type ContentType,
  type Locale,
  localeValidator,
  SUPPORTED_CONTENT_LOCALES,
} from "@repo/backend/convex/lib/validators/contents";
import { ConvexError, type Infer, v } from "convex/values";

export type AuthorCache = Map<string, Id<"authors">>;

/** Convex validator for author names imported from source metadata. */
export const syncedAuthorValidator = v.object({
  name: v.string(),
});

/** Author name imported from source content metadata. */
export type SyncedAuthor = Infer<typeof syncedAuthorValidator>;

/** Convex validator for article references imported from source metadata. */
export const syncedArticleReferenceValidator = v.object({
  authors: v.string(),
  citation: v.optional(v.string()),
  details: v.optional(v.string()),
  publication: v.optional(v.string()),
  title: v.string(),
  url: v.optional(v.string()),
  year: v.number(),
});

/** Article reference imported from source content metadata. */
export type SyncedArticleReference = Infer<
  typeof syncedArticleReferenceValidator
>;

/** Convex validator for localized exercise choices from source metadata. */
export const syncedExerciseChoiceValidator = v.object({
  isCorrect: v.boolean(),
  label: v.string(),
  optionKey: v.string(),
  order: v.number(),
});

/** Localized exercise choice imported from source content metadata. */
export type SyncedExerciseChoice = Infer<typeof syncedExerciseChoiceValidator>;

/** Convex validator for locale-keyed exercise choice groups. */
export const syncedExerciseChoicesValidator = v.record(
  localeValidator,
  v.array(syncedExerciseChoiceValidator)
);

/** Locale-keyed exercise choices derived from the Convex validator. */
export type SyncedExerciseChoices = Infer<
  typeof syncedExerciseChoicesValidator
>;

/** Load existing authors into a lookup map keyed by author name. */
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
        .withIndex("by_name", (q) => q.eq("name", name))
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

/** Replace one content item's author links from a preloaded author cache. */
export async function syncContentAuthorsWithCache(
  ctx: MutationCtx,
  contentId: ContentAuthorContentId,
  contentType: ContentType,
  authors: SyncedAuthor[],
  authorCache: AuthorCache
): Promise<number> {
  assertContentSyncBatchSize({
    functionName: "syncContentAuthorsWithCache",
    limit: CONTENT_SYNC_BATCH_LIMITS.authors,
    received: authors.length,
    unit: "authors",
  });

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

/** Replace one article's references within the bounded sync batch limits. */
export async function replaceArticleReferences(
  ctx: MutationCtx,
  articleId: Id<"articleContents">,
  references: SyncedArticleReference[]
): Promise<number> {
  assertContentSyncBatchSize({
    functionName: "replaceArticleReferences",
    limit: CONTENT_SYNC_BATCH_LIMITS.articleReferences,
    received: references.length,
    unit: "article references",
  });

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

/** Replace one question's multiple-choice options within the bounded sync limits. */
export async function replaceExerciseChoices(
  ctx: MutationCtx,
  args: {
    choices: SyncedExerciseChoices;
    questionId: Id<"exerciseQuestions">;
  }
): Promise<number> {
  for (const locale of SUPPORTED_CONTENT_LOCALES) {
    assertContentSyncBatchSize({
      functionName: "replaceExerciseChoices",
      limit: CONTENT_SYNC_BATCH_LIMITS.exerciseChoices,
      received: args.choices[locale].length,
      unit: `${locale} exercise choices`,
    });
  }

  await deleteExerciseChoicesForQuestion(ctx, args.questionId);

  let created = 0;

  for (const locale of SUPPORTED_CONTENT_LOCALES) {
    for (const choice of args.choices[locale]) {
      await ctx.db.insert("exerciseChoices", {
        isCorrect: choice.isCorrect,
        label: choice.label,
        locale,
        optionKey: choice.optionKey,
        order: choice.order,
        questionId: args.questionId,
      });
      created++;
    }
  }

  return created;
}

/** Delete all author links for one content item under the sync safety limits. */
export async function deleteContentAuthorLinks(
  ctx: MutationCtx,
  contentId: ContentAuthorContentId,
  contentType: ContentType
) {
  const existingLinks = await ctx.db
    .query("contentAuthors")
    .withIndex("by_contentId_and_contentType_and_authorId", (q) =>
      q.eq("contentId", contentId).eq("contentType", contentType)
    )
    .take(CONTENT_SYNC_BATCH_LIMITS.authors + 1);

  if (existingLinks.length > CONTENT_SYNC_BATCH_LIMITS.authors) {
    throw new ConvexError({
      code: "CONTENT_SYNC_LINK_COUNT_EXCEEDED",
      message:
        "Existing content author link count exceeds the safe sync limit.",
    });
  }

  for (const link of existingLinks) {
    await ctx.db.delete("contentAuthors", link._id);
  }
}

/** Delete all references for one article under the sync safety limits. */
export async function deleteArticleReferencesForArticle(
  ctx: MutationCtx,
  articleId: Id<"articleContents">
) {
  const existingReferences = await ctx.db
    .query("articleReferences")
    .withIndex("by_articleId", (q) => q.eq("articleId", articleId))
    .take(CONTENT_SYNC_BATCH_LIMITS.articleReferences + 1);

  if (existingReferences.length > CONTENT_SYNC_BATCH_LIMITS.articleReferences) {
    throw new ConvexError({
      code: "CONTENT_SYNC_REFERENCE_COUNT_EXCEEDED",
      message: "Existing article reference count exceeds the safe sync limit.",
    });
  }

  for (const reference of existingReferences) {
    await ctx.db.delete("articleReferences", reference._id);
  }
}

/** Delete all choices for one question under the sync safety limits. */
export async function deleteExerciseChoicesForQuestion(
  ctx: MutationCtx,
  questionId: Id<"exerciseQuestions">
) {
  const choiceLimit = CONTENT_SYNC_BATCH_LIMITS.exerciseChoices * 2;
  const existingChoices = await ctx.db
    .query("exerciseChoices")
    .withIndex("by_questionId_and_locale", (q) =>
      q.eq("questionId", questionId)
    )
    .take(choiceLimit + 1);

  if (existingChoices.length > choiceLimit) {
    throw new ConvexError({
      code: "CONTENT_SYNC_CHOICE_COUNT_EXCEEDED",
      message: "Existing exercise choice count exceeds the safe sync limit.",
    });
  }

  for (const choice of existingChoices) {
    await ctx.db.delete("exerciseChoices", choice._id);
  }
}

/** Delete synced search and route projections by their graph source identity. */
export async function deleteContentProjectionsBySourcePath(
  ctx: MutationCtx,
  args: { locale: Locale; route: string }
) {
  const source = { locale: args.locale, sourcePath: args.route };

  await deleteContentSearchBySourcePath(ctx, source);
  await deleteContentRoutesBySourcePath(ctx, source);
}

/** Delete one exercise question together with its sync-managed dependent rows. */
export async function deleteExerciseQuestion(
  ctx: MutationCtx,
  questionId: Id<"exerciseQuestions">
) {
  const question = await ctx.db.get(questionId);

  if (question) {
    await deleteContentProjectionsBySourcePath(ctx, {
      locale: question.locale,
      route: question.slug,
    });
  }

  await deleteContentAuthorLinks(ctx, questionId, "material");
  await deleteExerciseChoicesForQuestion(ctx, questionId);
  await ctx.db.delete("exerciseQuestions", questionId);
}

/** Delete one curriculum lesson together with its sync-managed author links. */
export async function deleteCurriculumLesson(
  ctx: MutationCtx,
  sectionId: Id<"curriculumLessons">
) {
  const section = await ctx.db.get(sectionId);

  if (section) {
    await deleteContentProjectionsBySourcePath(ctx, {
      locale: section.locale,
      route: section.slug,
    });
  }

  await deleteContentAuthorLinks(ctx, sectionId, "material");
  if (section) {
    await deleteAudioContentSourceByRoute(ctx, {
      contentType: "material",
      locale: section.locale,
      route: section.slug,
    });
  }
  await ctx.db.delete("curriculumLessons", sectionId);
}
