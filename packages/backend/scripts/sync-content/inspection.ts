import { internal } from "@repo/backend/convex/_generated/api";
import { callConvexQuery } from "@repo/backend/scripts/sync-content/convex";
import {
  ArticleIntegrityPageSchema,
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
import type {
  DefaultFunctionArgs,
  FunctionArgs,
  FunctionReference,
  FunctionReturnType,
} from "convex/server";
import { Effect, Schema } from "effect";

const PAGE_SIZE = 1000;

interface PageResult {
  continueCursor: string;
  isDone: boolean;
  page: unknown[];
}

type PageQuery = FunctionReference<
  "query",
  "internal" | "public",
  DefaultFunctionArgs,
  PageResult
>;

type PageRow<TFunction extends PageQuery> =
  FunctionReturnType<TFunction>["page"][number];

type StaleContentArgs = FunctionArgs<
  typeof internal.contentSync.queries.stale.listStaleContentPage
>;

interface PaginationArgs {
  cursor: string | null;
  numItems: number;
}

/** Builds typed stale-content query args for one content table. */
const buildStaleContentArgs =
  (tableName: StaleContentArgs["tableName"]) =>
  (paginationOpts: PaginationArgs): StaleContentArgs => ({
    paginationOpts,
    tableName,
  });

/** Reads every page from a generated paginated Convex query reference. */
const collectPages = Effect.fn("sync.collectPages")(function* <
  TFunction extends PageQuery,
  Encoded,
>(
  config: ConvexConfig,
  query: TFunction,
  buildArgs: (paginationOpts: PaginationArgs) => FunctionArgs<TFunction>,
  schema: Schema.Schema<FunctionReturnType<TFunction>, Encoded, never>
) {
  const rows: PageRow<TFunction>[] = [];
  let continueCursor: string | null = null;
  let isDone = false;
  let page: PageRow<TFunction>[] = [];

  while (!isDone) {
    ({ continueCursor, isDone, page } = yield* callConvexQuery(
      config,
      query,
      buildArgs({
        cursor: continueCursor,
        numItems: PAGE_SIZE,
      }),
      schema
    ));

    rows.push(...page);
  }

  return rows;
});

/** Finds database content rows whose source slugs are no longer on disk. */
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
      internal.contentSync.queries.stale.listStaleContentPage,
      buildStaleContentArgs("articleContents"),
      StaleContentPageSchema
    ),
    collectPages(
      config,
      internal.contentSync.queries.stale.listStaleContentPage,
      buildStaleContentArgs("subjectTopics"),
      StaleContentPageSchema
    ),
    collectPages(
      config,
      internal.contentSync.queries.stale.listStaleContentPage,
      buildStaleContentArgs("subjectSections"),
      StaleContentPageSchema
    ),
    collectPages(
      config,
      internal.contentSync.queries.stale.listStaleContentPage,
      buildStaleContentArgs("exerciseSets"),
      StaleContentPageSchema
    ),
    collectPages(
      config,
      internal.contentSync.queries.stale.listStaleContentPage,
      buildStaleContentArgs("exerciseQuestions"),
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

/** Summarizes missing content relationships for sync verification. */
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
      internal.contentSync.queries.integrity.listIntegrityExerciseQuestionsPage,
      (paginationOpts) => ({ paginationOpts }),
      ExerciseQuestionIntegrityPageSchema
    ),
    collectPages(
      config,
      internal.contentSync.queries.integrity.listIntegrityExerciseChoicesPage,
      (paginationOpts) => ({ paginationOpts }),
      ExerciseChoiceIntegrityPageSchema
    ),
    collectPages(
      config,
      internal.contentSync.queries.integrity.listIntegrityContentAuthorsPage,
      (paginationOpts) => ({ paginationOpts }),
      ContentAuthorIntegrityPageSchema
    ),
    collectPages(
      config,
      internal.contentSync.queries.integrity.listIntegrityArticleReferencesPage,
      (paginationOpts) => ({ paginationOpts }),
      ArticleReferenceIntegrityPageSchema
    ),
    collectPages(
      config,
      internal.contentSync.queries.integrity.listIntegrityArticlesPage,
      (paginationOpts) => ({ paginationOpts }),
      ArticleIntegrityPageSchema
    ),
    collectPages(
      config,
      internal.contentSync.queries.integrity.listIntegritySubjectSectionsPage,
      (paginationOpts) => ({ paginationOpts }),
      SubjectSectionIntegrityPageSchema
    ),
    collectPages(
      config,
      internal.contentSync.queries.tryouts.getTryoutScaleIntegrity,
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

/** Returns authors that are not referenced by any content-author links. */
export const getUnusedAuthors = Effect.fn("sync.getUnusedAuthors")(function* (
  config: ConvexConfig
) {
  const [authors, contentAuthors] = yield* Effect.all([
    collectPages(
      config,
      internal.contentSync.queries.authors.listAuthorsPage,
      (paginationOpts) => ({ paginationOpts }),
      AuthorPageSchema
    ),
    collectPages(
      config,
      internal.contentSync.queries.integrity.listIntegrityContentAuthorsPage,
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
