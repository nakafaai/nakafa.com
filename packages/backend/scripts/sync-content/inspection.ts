import type { Ref } from "@confect/core";
import refs from "@repo/backend/confect/_generated/refs";
import { callConvex } from "@repo/backend/scripts/sync-content/convex";
import {
  ArticleReferenceIntegrityPageSchema,
  AuthorPageSchema,
  ContentAuthorIntegrityPageSchema,
  DataIntegritySchema,
  ExerciseChoiceIntegrityPageSchema,
  ExerciseQuestionIntegrityPageSchema,
  StaleContentPageSchema,
  StaleContentSchema,
  SubjectSectionIntegrityPageSchema,
  TryoutScaleIntegritySchema,
  UnusedAuthorsSchema,
} from "@repo/backend/scripts/sync-content/schemas";
import type {
  ConvexConfig,
  FilesystemSlugs,
} from "@repo/backend/scripts/sync-content/types";
import { Effect, Schema } from "effect";

const PAGE_SIZE = 1000;

interface PageResult<T> {
  continueCursor: string;
  isDone: boolean;
  page: readonly T[];
}

const collectPages = Effect.fn("sync.collectPages")(function* <T>(
  config: ConvexConfig,
  ref: Ref.AnyQuery,
  getArgs: (paginationOpts: {
    cursor: string | null;
    numItems: number;
  }) => Ref.Args<typeof ref>,
  schema: Schema.Schema<PageResult<T>>
) {
  const rows: T[] = [];
  let continueCursor: string | null = null;
  let isDone = false;
  let page: readonly T[] = [];

  while (!isDone) {
    ({ continueCursor, isDone, page } = yield* callConvex(
      config,
      "query",
      ref,
      getArgs({
        cursor: continueCursor,
        numItems: PAGE_SIZE,
      }),
      schema
    ));

    rows.push(...page);
  }

  return rows;
});

export const getStaleContent = Effect.fn("sync.getStaleContent")(function* (
  config: ConvexConfig,
  filesystemSlugs: FilesystemSlugs
) {
  const articleSlugSet = new Set(filesystemSlugs.articleSlugs);
  const subjectTopicSlugSet = new Set(filesystemSlugs.subjectTopicSlugs);
  const subjectSectionSlugSet = new Set(filesystemSlugs.subjectSectionSlugs);
  const exerciseSetSlugSet = new Set(filesystemSlugs.exerciseSetSlugs);
  const exerciseQuestionSlugSet = new Set(
    filesystemSlugs.exerciseQuestionSlugs
  );
  const [
    articles,
    subjectTopics,
    subjectSections,
    exerciseSets,
    exerciseQuestions,
  ] = yield* Effect.all([
    collectPages(
      config,
      refs.internal.contentSync.queries.stale.listStaleContentPage,
      (paginationOpts) => ({ tableName: "articleContents", paginationOpts }),
      StaleContentPageSchema
    ),
    collectPages(
      config,
      refs.internal.contentSync.queries.stale.listStaleContentPage,
      (paginationOpts) => ({ tableName: "subjectTopics", paginationOpts }),
      StaleContentPageSchema
    ),
    collectPages(
      config,
      refs.internal.contentSync.queries.stale.listStaleContentPage,
      (paginationOpts) => ({ tableName: "subjectSections", paginationOpts }),
      StaleContentPageSchema
    ),
    collectPages(
      config,
      refs.internal.contentSync.queries.stale.listStaleContentPage,
      (paginationOpts) => ({ tableName: "exerciseSets", paginationOpts }),
      StaleContentPageSchema
    ),
    collectPages(
      config,
      refs.internal.contentSync.queries.stale.listStaleContentPage,
      (paginationOpts) => ({ tableName: "exerciseQuestions", paginationOpts }),
      StaleContentPageSchema
    ),
  ]);

  return Schema.decodeUnknownSync(StaleContentSchema)({
    staleArticles: articles.filter((item) => !articleSlugSet.has(item.slug)),
    staleSubjectTopics: subjectTopics.filter(
      (item) => !subjectTopicSlugSet.has(item.slug)
    ),
    staleSubjectSections: subjectSections.filter(
      (item) => !subjectSectionSlugSet.has(item.slug)
    ),
    staleExerciseSets: exerciseSets.filter(
      (item) => !exerciseSetSlugSet.has(item.slug)
    ),
    staleExerciseQuestions: exerciseQuestions.filter(
      (item) => !exerciseQuestionSlugSet.has(item.slug)
    ),
  });
});

export const getDataIntegrity = Effect.fn("sync.getDataIntegrity")(function* (
  config: ConvexConfig
) {
  const [
    questions,
    choices,
    contentAuthors,
    references,
    articles,
    sections,
    tryoutScaleIntegrity,
  ] = yield* Effect.all([
    collectPages(
      config,
      refs.internal.contentSync.queries.integrity
        .listIntegrityExerciseQuestionsPage,
      (paginationOpts) => ({ paginationOpts }),
      ExerciseQuestionIntegrityPageSchema
    ),
    collectPages(
      config,
      refs.internal.contentSync.queries.integrity
        .listIntegrityExerciseChoicesPage,
      (paginationOpts) => ({ paginationOpts }),
      ExerciseChoiceIntegrityPageSchema
    ),
    collectPages(
      config,
      refs.internal.contentSync.queries.integrity
        .listIntegrityContentAuthorsPage,
      (paginationOpts) => ({ paginationOpts }),
      ContentAuthorIntegrityPageSchema
    ),
    collectPages(
      config,
      refs.internal.contentSync.queries.integrity
        .listIntegrityArticleReferencesPage,
      (paginationOpts) => ({ paginationOpts }),
      ArticleReferenceIntegrityPageSchema
    ),
    collectPages(
      config,
      refs.internal.contentSync.queries.integrity.listIntegrityArticlesPage,
      (paginationOpts) => ({ paginationOpts }),
      StaleContentPageSchema
    ),
    collectPages(
      config,
      refs.internal.contentSync.queries.integrity
        .listIntegritySubjectSectionsPage,
      (paginationOpts) => ({ paginationOpts }),
      SubjectSectionIntegrityPageSchema
    ),
    collectPages(
      config,
      refs.internal.contentSync.queries.tryouts.getTryoutScaleIntegrity,
      (paginationOpts) => ({ paginationOpts }),
      TryoutScaleIntegritySchema
    ),
  ]);
  const questionIdsWithChoices = new Set(
    choices.map((choice) => choice.questionId)
  );
  const questionIdsWithAuthors = new Set(
    contentAuthors
      .filter((authorLink) => authorLink.contentType === "exercise")
      .map((authorLink) => authorLink.contentId)
  );
  const articleIdsWithReferences = new Set(
    references.map((reference) => reference.articleId)
  );

  return Schema.decodeUnknownSync(DataIntegritySchema)({
    questionsWithoutChoices: questions
      .filter((question) => !questionIdsWithChoices.has(question.id))
      .map((question) => `${question.slug} (${question.locale})`),
    questionsWithoutAuthors: questions
      .filter((question) => !questionIdsWithAuthors.has(question.id))
      .map((question) => `${question.slug} (${question.locale})`),
    articlesWithoutReferences: articles
      .filter((article) => !articleIdsWithReferences.has(article.id))
      .map((article) => `${article.slug} (${article.locale})`),
    sectionsWithoutTopics: sections
      .filter((section) => !section.topicId)
      .map((section) => `${section.slug} (${section.locale})`),
    activeTryoutsWithoutScale: tryoutScaleIntegrity.map(
      (tryout) => `${tryout.product}/${tryout.locale}/${tryout.slug}`
    ),
    totalQuestions: questions.length,
    totalArticles: articles.length,
    totalSections: sections.length,
  });
});

export const getUnusedAuthors = Effect.fn("sync.getUnusedAuthors")(function* (
  config: ConvexConfig
) {
  const [authors, contentAuthors] = yield* Effect.all([
    collectPages(
      config,
      refs.internal.contentSync.queries.authors.listAuthorsPage,
      (paginationOpts) => ({ paginationOpts }),
      AuthorPageSchema
    ),
    collectPages(
      config,
      refs.internal.contentSync.queries.integrity
        .listIntegrityContentAuthorsPage,
      (paginationOpts) => ({ paginationOpts }),
      ContentAuthorIntegrityPageSchema
    ),
  ]);
  const authorIdsWithContent = new Set(
    contentAuthors.map((authorLink) => authorLink.authorId)
  );

  return Schema.decodeUnknownSync(UnusedAuthorsSchema)({
    unusedAuthors: authors.filter(
      (author) => !authorIdsWithContent.has(author.id)
    ),
  });
});
