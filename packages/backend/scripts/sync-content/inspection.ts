import type { Ref } from "@confect/core";
import refs from "@repo/backend/confect/_generated/refs";
import { ArticleContents } from "@repo/backend/confect/modules/content/articleContents.tables";
import { ExerciseQuestions } from "@repo/backend/confect/modules/content/exerciseQuestions.tables";
import { ExerciseSets } from "@repo/backend/confect/modules/content/exerciseSets.tables";
import { SubjectSections } from "@repo/backend/confect/modules/content/subjectSections.tables";
import { SubjectTopics } from "@repo/backend/confect/modules/content/subjectTopics.tables";
import { callConvex } from "@repo/backend/scripts/sync-content/convex";
import {
  DataIntegritySchema,
  StaleContentSchema,
} from "@repo/backend/scripts/sync-content/schemas";
import type {
  ConvexConfig,
  FilesystemSlugs,
} from "@repo/backend/scripts/sync-content/types";
import { Effect, Schema } from "effect";

const PAGE_SIZE = 1000;

type PageItem<Query extends Ref.AnyQuery> =
  Ref.Returns<Query> extends { readonly page: readonly (infer Item)[] }
    ? Item
    : never;

type StaleContentTableName = Ref.Args<
  typeof refs.internal.contentSync.queries.stale.listStaleContentPage
>["tableName"];

const staleContentTableNames = {
  articles: ArticleContents.name,
  exerciseQuestions: ExerciseQuestions.name,
  exerciseSets: ExerciseSets.name,
  subjectSections: SubjectSections.name,
  subjectTopics: SubjectTopics.name,
} as const satisfies Record<string, StaleContentTableName>;

const collectPages = Effect.fn("sync.collectPages")(function* <
  Query extends Ref.AnyQuery,
>(
  config: ConvexConfig,
  ref: Query,
  getArgs: (paginationOpts: {
    cursor: string | null;
    numItems: number;
  }) => Ref.Args<Query>
) {
  const rows: PageItem<Query>[] = [];
  let continueCursor: string | null = null;
  let isDone = false;
  let page: readonly PageItem<Query>[] = [];

  while (!isDone) {
    const result: Ref.Returns<Query> = yield* callConvex(
      config,
      "query",
      ref,
      getArgs({
        cursor: continueCursor,
        numItems: PAGE_SIZE,
      })
    );
    continueCursor = result.continueCursor;
    isDone = result.isDone;
    page = result.page;

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
      (paginationOpts) => ({
        paginationOpts,
        tableName: staleContentTableNames.articles,
      })
    ),
    collectPages(
      config,
      refs.internal.contentSync.queries.stale.listStaleContentPage,
      (paginationOpts) => ({
        paginationOpts,
        tableName: staleContentTableNames.subjectTopics,
      })
    ),
    collectPages(
      config,
      refs.internal.contentSync.queries.stale.listStaleContentPage,
      (paginationOpts) => ({
        paginationOpts,
        tableName: staleContentTableNames.subjectSections,
      })
    ),
    collectPages(
      config,
      refs.internal.contentSync.queries.stale.listStaleContentPage,
      (paginationOpts) => ({
        paginationOpts,
        tableName: staleContentTableNames.exerciseSets,
      })
    ),
    collectPages(
      config,
      refs.internal.contentSync.queries.stale.listStaleContentPage,
      (paginationOpts) => ({
        paginationOpts,
        tableName: staleContentTableNames.exerciseQuestions,
      })
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
      (paginationOpts) => ({ paginationOpts })
    ),
    collectPages(
      config,
      refs.internal.contentSync.queries.integrity
        .listIntegrityExerciseChoicesPage,
      (paginationOpts) => ({ paginationOpts })
    ),
    collectPages(
      config,
      refs.internal.contentSync.queries.integrity
        .listIntegrityContentAuthorsPage,
      (paginationOpts) => ({ paginationOpts })
    ),
    collectPages(
      config,
      refs.internal.contentSync.queries.integrity
        .listIntegrityArticleReferencesPage,
      (paginationOpts) => ({ paginationOpts })
    ),
    collectPages(
      config,
      refs.internal.contentSync.queries.integrity.listIntegrityArticlesPage,
      (paginationOpts) => ({ paginationOpts })
    ),
    collectPages(
      config,
      refs.internal.contentSync.queries.integrity
        .listIntegritySubjectSectionsPage,
      (paginationOpts) => ({ paginationOpts })
    ),
    collectPages(
      config,
      refs.internal.contentSync.queries.tryouts.getTryoutScaleIntegrity,
      (paginationOpts) => ({ paginationOpts })
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
      (paginationOpts) => ({ paginationOpts })
    ),
    collectPages(
      config,
      refs.internal.contentSync.queries.integrity
        .listIntegrityContentAuthorsPage,
      (paginationOpts) => ({ paginationOpts })
    ),
  ]);
  const authorIdsWithContent = new Set(
    contentAuthors.map((authorLink) => authorLink.authorId)
  );

  return {
    unusedAuthors: authors.filter(
      (author) => !authorIdsWithContent.has(author.id)
    ),
  };
});
