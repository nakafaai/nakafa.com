import { DatabaseReader } from "@repo/backend/confect/_generated/services";
import type {
  CountableTableName,
  StaleContentTableName,
} from "@repo/backend/confect/modules/content/contentSync.shared";
import type { PaginationOptions } from "convex/server";
import { Effect, Option } from "effect";

/** Counts one page from a sync-audited table. */
export const countTablePage = Effect.fn("contentSync.queries.countTablePage")(
  function* (args: {
    paginationOpts: PaginationOptions;
    tableName: CountableTableName;
  }) {
    const reader = yield* DatabaseReader;
    const page = yield* reader
      .table(args.tableName)
      .index("by_creation_time")
      .paginate(args.paginationOpts);

    return {
      continueCursor: page.continueCursor,
      isDone: page.isDone,
      pageSize: page.page.length,
    };
  }
);

/** Lists stale content rows by table for cleanup tooling. */
export const listStaleContentPage = Effect.fn(
  "contentSync.queries.listStaleContentPage"
)(function* (args: {
  paginationOpts: PaginationOptions;
  tableName: StaleContentTableName;
}) {
  const reader = yield* DatabaseReader;
  const page = yield* reader
    .table(args.tableName)
    .index("by_creation_time")
    .paginate(args.paginationOpts);

  return {
    ...page,
    page: page.page.map((item) => ({
      id: item._id,
      locale: item.locale,
      slug: item.slug,
    })),
  };
});

/** Lists exercise questions for sync integrity checks. */
export const listIntegrityExerciseQuestionsPage = Effect.fn(
  "contentSync.queries.listIntegrityExerciseQuestionsPage"
)(function* (args: { paginationOpts: PaginationOptions }) {
  const reader = yield* DatabaseReader;
  const page = yield* reader
    .table("exerciseQuestions")
    .index("by_creation_time")
    .paginate(args.paginationOpts);

  return {
    ...page,
    page: page.page.map((question) => ({
      id: question._id,
      locale: question.locale,
      slug: question.slug,
    })),
  };
});

/** Lists exercise choices for sync integrity checks. */
export const listIntegrityExerciseChoicesPage = Effect.fn(
  "contentSync.queries.listIntegrityExerciseChoicesPage"
)(function* (args: { paginationOpts: PaginationOptions }) {
  const reader = yield* DatabaseReader;
  const page = yield* reader
    .table("exerciseChoices")
    .index("by_creation_time")
    .paginate(args.paginationOpts);

  return {
    ...page,
    page: page.page.map((choice) => ({
      questionId: choice.questionId,
    })),
  };
});

/** Lists content-author links for sync integrity checks. */
export const listIntegrityContentAuthorsPage = Effect.fn(
  "contentSync.queries.listIntegrityContentAuthorsPage"
)(function* (args: { paginationOpts: PaginationOptions }) {
  const reader = yield* DatabaseReader;
  const page = yield* reader
    .table("contentAuthors")
    .index("by_creation_time")
    .paginate(args.paginationOpts);

  return {
    ...page,
    page: page.page.map((contentAuthor) => ({
      authorId: contentAuthor.authorId,
      contentId: contentAuthor.contentId,
      contentType: contentAuthor.contentType,
    })),
  };
});

/** Lists article-reference links for sync integrity checks. */
export const listIntegrityArticleReferencesPage = Effect.fn(
  "contentSync.queries.listIntegrityArticleReferencesPage"
)(function* (args: { paginationOpts: PaginationOptions }) {
  const reader = yield* DatabaseReader;
  const page = yield* reader
    .table("articleReferences")
    .index("by_creation_time")
    .paginate(args.paginationOpts);

  return {
    ...page,
    page: page.page.map((reference) => ({
      articleId: reference.articleId,
    })),
  };
});

/** Lists articles for sync integrity checks. */
export const listIntegrityArticlesPage = Effect.fn(
  "contentSync.queries.listIntegrityArticlesPage"
)(function* (args: { paginationOpts: PaginationOptions }) {
  const reader = yield* DatabaseReader;
  const page = yield* reader
    .table("articleContents")
    .index("by_creation_time")
    .paginate(args.paginationOpts);

  return {
    ...page,
    page: page.page.map((article) => ({
      id: article._id,
      locale: article.locale,
      slug: article.slug,
    })),
  };
});

/** Lists subject sections for sync integrity checks. */
export const listIntegritySubjectSectionsPage = Effect.fn(
  "contentSync.queries.listIntegritySubjectSectionsPage"
)(function* (args: { paginationOpts: PaginationOptions }) {
  const reader = yield* DatabaseReader;
  const page = yield* reader
    .table("subjectSections")
    .index("by_creation_time")
    .paginate(args.paginationOpts);

  return {
    ...page,
    page: page.page.map((section) => ({
      locale: section.locale,
      slug: section.slug,
      topicId: section.topicId,
    })),
  };
});

/** Lists active tryouts that do not yet have a published IRT scale. */
export const getTryoutScaleIntegrity = Effect.fn(
  "contentSync.queries.getTryoutScaleIntegrity"
)(function* (args: { paginationOpts: PaginationOptions }) {
  const reader = yield* DatabaseReader;
  const tryoutPage = yield* reader
    .table("tryouts")
    .index("by_isActive", (query) => query.eq("isActive", true))
    .paginate(args.paginationOpts);
  const scaleCandidates = yield* Effect.forEach(tryoutPage.page, (tryout) =>
    Effect.gen(function* () {
      const scaleVersion = yield* reader
        .table("irtScaleVersions")
        .index(
          "by_tryoutId_and_publishedAt",
          (query) => query.eq("tryoutId", tryout._id),
          "desc"
        )
        .first();

      if (Option.isSome(scaleVersion)) {
        return null;
      }

      return {
        cycleKey: tryout.cycleKey,
        locale: tryout.locale,
        product: tryout.product,
        slug: tryout.slug,
      };
    })
  );
  const activeTryoutsWithoutScale = scaleCandidates.filter(
    (candidate) => candidate !== null
  );

  return {
    continueCursor: tryoutPage.continueCursor,
    isDone: tryoutPage.isDone,
    page: activeTryoutsWithoutScale,
  };
});
