import type { Id } from "@repo/backend/confect/_generated/dataModel";
import {
  DatabaseReader,
  DatabaseWriter,
  StorageWriter,
} from "@repo/backend/confect/_generated/services";
import { CONTENT_SYNC_BATCH_LIMITS } from "@repo/backend/confect/modules/content/constants";
import type {
  ContentType,
  Locale,
} from "@repo/backend/confect/modules/content/content.schemas";
import { buildContentSearchRef } from "@repo/backend/confect/modules/content/contentSearch/documents.service";
import { deleteContentSearch } from "@repo/backend/confect/modules/content/contentSearch/writes.service";
import {
  assertContentSyncBatchSize,
  ContentSyncError,
} from "@repo/backend/confect/modules/content/contentSync.shared";
import { Clock, Effect, Option } from "effect";

type ContentId =
  | Id<"articleContents">
  | Id<"subjectSections">
  | Id<"exerciseQuestions">;

/** Builds a name to author-id cache for sync batches. */
export const buildAuthorCache = Effect.fn(
  "contentSync.helpers.buildAuthorCache"
)(function* (authorNames: readonly string[]) {
  const reader = yield* DatabaseReader;
  const cache = new Map<string, Id<"authors">>();
  const uniqueNames = [...new Set(authorNames)];

  for (const name of uniqueNames) {
    const author = yield* reader
      .table("authors")
      .index("by_name", (query) => query.eq("name", name))
      .first()
      .pipe(Effect.map(Option.getOrNull));

    if (author) {
      cache.set(name, author._id);
    }
  }

  return cache;
});

/** Deletes content-author links for one synced content row. */
export const deleteContentAuthorLinks = Effect.fn(
  "contentSync.helpers.deleteContentAuthorLinks"
)(function* (contentId: ContentId, contentType: ContentType) {
  const reader = yield* DatabaseReader;
  const writer = yield* DatabaseWriter;
  const existingLinks = yield* reader
    .table("contentAuthors")
    .index("by_contentId_and_contentType_and_authorId", (query) =>
      query.eq("contentId", contentId).eq("contentType", contentType)
    )
    .take(CONTENT_SYNC_BATCH_LIMITS.authors + 1);

  if (existingLinks.length > CONTENT_SYNC_BATCH_LIMITS.authors) {
    return yield* Effect.fail(
      new ContentSyncError({
        message:
          "Existing content author link count exceeds the safe sync limit.",
      })
    );
  }

  for (const link of existingLinks) {
    yield* writer.table("contentAuthors").delete(link._id);
  }
});

/** Replaces content-author links using a preloaded author cache. */
export const syncContentAuthorsWithCache = Effect.fn(
  "contentSync.helpers.syncContentAuthorsWithCache"
)(function* (
  contentId: ContentId,
  contentType: ContentType,
  authors: readonly { readonly name: string }[],
  authorCache: Map<string, Id<"authors">>
) {
  const writer = yield* DatabaseWriter;
  yield* assertContentSyncBatchSize({
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
    return yield* Effect.fail(
      new ContentSyncError({
        message: `Missing author(s) for ${contentType} ${contentId}: ${missingAuthorNames.join(", ")}. Run bulkSyncAuthors first.`,
      })
    );
  }

  yield* deleteContentAuthorLinks(contentId, contentType);
  let linksCreated = 0;

  for (const [order, author] of authors.entries()) {
    const authorId = authorCache.get(author.name);

    if (!authorId) {
      return yield* Effect.fail(
        new ContentSyncError({
          message: `Missing author cache entry for ${author.name}.`,
        })
      );
    }

    yield* writer.table("contentAuthors").insert({
      authorId,
      contentId,
      contentType,
      order,
    });
    linksCreated += 1;
  }

  return linksCreated;
});

/** Deletes article references for one article. */
export const deleteArticleReferencesForArticle = Effect.fn(
  "contentSync.helpers.deleteArticleReferencesForArticle"
)(function* (articleId: Id<"articleContents">) {
  const reader = yield* DatabaseReader;
  const writer = yield* DatabaseWriter;
  const existingReferences = yield* reader
    .table("articleReferences")
    .index("by_articleId", (query) => query.eq("articleId", articleId))
    .take(CONTENT_SYNC_BATCH_LIMITS.articleReferences + 1);

  if (existingReferences.length > CONTENT_SYNC_BATCH_LIMITS.articleReferences) {
    return yield* Effect.fail(
      new ContentSyncError({
        message:
          "Existing article reference count exceeds the safe sync limit.",
      })
    );
  }

  for (const reference of existingReferences) {
    yield* writer.table("articleReferences").delete(reference._id);
  }
});

/** Replaces article references for one article. */
export const replaceArticleReferences = Effect.fn(
  "contentSync.helpers.replaceArticleReferences"
)(function* (
  articleId: Id<"articleContents">,
  references: readonly {
    readonly authors: string;
    readonly citation?: string;
    readonly details?: string;
    readonly publication?: string;
    readonly title: string;
    readonly url?: string;
    readonly year: number;
  }[]
) {
  yield* assertContentSyncBatchSize({
    functionName: "replaceArticleReferences",
    limit: CONTENT_SYNC_BATCH_LIMITS.articleReferences,
    received: references.length,
    unit: "article references",
  });
  const writer = yield* DatabaseWriter;
  yield* deleteArticleReferencesForArticle(articleId);
  let created = 0;

  for (const [order, reference] of references.entries()) {
    yield* writer.table("articleReferences").insert({
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
    created += 1;
  }

  return created;
});

/** Deletes choices for one exercise question. */
export const deleteExerciseChoicesForQuestion = Effect.fn(
  "contentSync.helpers.deleteExerciseChoicesForQuestion"
)(function* (questionId: Id<"exerciseQuestions">) {
  const reader = yield* DatabaseReader;
  const writer = yield* DatabaseWriter;
  const existingChoices = yield* reader
    .table("exerciseChoices")
    .index("by_questionId_and_locale", (query) =>
      query.eq("questionId", questionId)
    )
    .take(CONTENT_SYNC_BATCH_LIMITS.exerciseChoices + 1);

  if (existingChoices.length > CONTENT_SYNC_BATCH_LIMITS.exerciseChoices) {
    return yield* Effect.fail(
      new ContentSyncError({
        message: "Existing exercise choice count exceeds the safe sync limit.",
      })
    );
  }

  for (const choice of existingChoices) {
    yield* writer.table("exerciseChoices").delete(choice._id);
  }
});

/** Replaces choices for one exercise question. */
export const replaceExerciseChoices = Effect.fn(
  "contentSync.helpers.replaceExerciseChoices"
)(function* (args: {
  readonly choices: readonly {
    readonly isCorrect: boolean;
    readonly label: string;
    readonly optionKey: string;
    readonly order: number;
  }[];
  readonly locale: Locale;
  readonly questionId: Id<"exerciseQuestions">;
}) {
  const writer = yield* DatabaseWriter;
  yield* assertContentSyncBatchSize({
    functionName: "replaceExerciseChoices",
    limit: CONTENT_SYNC_BATCH_LIMITS.exerciseChoices,
    received: args.choices.length,
    unit: "exercise choices",
  });
  yield* deleteExerciseChoicesForQuestion(args.questionId);
  let created = 0;

  for (const choice of args.choices) {
    yield* writer.table("exerciseChoices").insert({
      isCorrect: choice.isCorrect,
      label: choice.label,
      locale: args.locale,
      optionKey: choice.optionKey,
      order: choice.order,
      questionId: args.questionId,
    });
    created += 1;
  }

  return created;
});

/** Deletes one exercise question and linked search/authors/choices. */
export const deleteExerciseQuestion = Effect.fn(
  "contentSync.helpers.deleteExerciseQuestion"
)(function* (questionId: Id<"exerciseQuestions">) {
  const reader = yield* DatabaseReader;
  const writer = yield* DatabaseWriter;
  const question = yield* reader
    .table("exerciseQuestions")
    .get(questionId)
    .pipe(Effect.catchTag("GetByIdFailure", () => Effect.succeed(null)));

  if (question) {
    const searchRef = buildContentSearchRef({
      locale: question.locale,
      route: question.slug,
      section: "exercises",
    });
    yield* deleteContentSearch(searchRef.content_id);
  }

  yield* deleteContentAuthorLinks(questionId, "exercise");
  yield* deleteExerciseChoicesForQuestion(questionId);
  yield* writer.table("exerciseQuestions").delete(questionId);
});

/** Deletes a subject section and its linked read models. */
export const deleteSubjectSection = Effect.fn(
  "contentSync.helpers.deleteSubjectSection"
)(function* (sectionId: Id<"subjectSections">) {
  const reader = yield* DatabaseReader;
  const writer = yield* DatabaseWriter;
  const section = yield* reader
    .table("subjectSections")
    .get(sectionId)
    .pipe(Effect.catchTag("GetByIdFailure", () => Effect.succeed(null)));

  if (section) {
    const searchRef = buildContentSearchRef({
      locale: section.locale,
      route: section.slug,
      section: "subject",
    });
    yield* deleteContentSearch(searchRef.content_id);
  }

  yield* deleteContentAuthorLinks(sectionId, "subject");
  yield* writer.table("subjectSections").delete(sectionId);
});

/** Updates audio content records after content hash changes. */
export const resetAudioForContentHash = Effect.fn(
  "contentSync.helpers.resetAudioForContentHash"
)(function* (args: {
  contentRef:
    | { readonly id: Id<"articleContents">; readonly type: "article" }
    | { readonly id: Id<"subjectSections">; readonly type: "subject" };
  newHash: string;
}) {
  const reader = yield* DatabaseReader;
  const writer = yield* DatabaseWriter;
  const storage = yield* StorageWriter;
  const audios = yield* reader
    .table("contentAudios")
    .index("by_contentRefType_and_contentRefId_and_locale", (query) =>
      query
        .eq("contentRef.type", args.contentRef.type)
        .eq("contentRef.id", args.contentRef.id)
    )
    .take(10);
  const now = yield* Clock.currentTimeMillis;

  for (const audio of audios) {
    if (audio.contentHash === args.newHash) {
      continue;
    }

    if (audio.audioStorageId) {
      const audioStorageId = audio.audioStorageId;
      yield* storage
        .delete(audioStorageId)
        .pipe(Effect.catchTag("BlobNotFoundError", () => Effect.succeed(null)));
    }

    yield* writer.table("contentAudios").patch(audio._id, {
      audioDuration: undefined,
      audioSize: undefined,
      audioStorageId: undefined,
      contentHash: args.newHash,
      errorMessage: undefined,
      failedAt: undefined,
      generationAttempts: 0,
      script: undefined,
      status: "pending",
      updatedAt: now,
    });
  }
});
