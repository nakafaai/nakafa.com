import { internal } from "@repo/backend/convex/_generated/api";
import { callConvexQuery } from "@repo/backend/scripts/sync-content/convex";
import {
  ArticleIntegrityPageSchema,
  ArticleReferenceIntegrityPageSchema,
  AuthorPageSchema,
  ContentAuthorIntegrityPageSchema,
  CurriculumLessonIntegrityPageSchema,
  DataIntegritySchema,
  ExerciseChoiceIntegrityPageSchema,
  ExerciseQuestionIntegrityPageSchema,
  GraphIdentityIntegrityPageSchema,
  GraphIdentityIntegritySchema,
  StaleContentPageSchema,
  StaleContentSchema,
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
export const GRAPH_IDENTITY_TARGETS = [
  "contentRoutes",
  "contentSearch",
  "contentRoutePages",
  "parts",
  "contentViews",
  "contentViewAnalyticsQueue",
  "learningPopularity",
  "learningTrendingBuckets",
  "audioContentSources",
  "audioGenerationQueue",
  "contentAudios",
] as const;

/** One page returned by the bounded Convex inspection queries. */
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

/** Pagination cursor passed to each bounded Convex inspection query. */
interface PaginationArgs {
  cursor: string | null;
  numItems: number;
}

type GraphIdentityTarget = (typeof GRAPH_IDENTITY_TARGETS)[number];
type Mutable<T> = { -readonly [K in keyof T]: T[K] };
type GraphIdentityIntegrityPage = Schema.Schema.Type<
  typeof GraphIdentityIntegrityPageSchema
>;
type GraphIdentityIntegrityTotal = Mutable<
  Omit<GraphIdentityIntegrityPage, "continueCursor" | "isDone">
>;

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

/** Chooses a bounded page size for each verifier target by row payload weight. */
function getGraphIdentityPageSize(target: GraphIdentityTarget) {
  if (target === "contentSearch") {
    return 500;
  }

  if (target === "parts") {
    return 100;
  }

  return PAGE_SIZE;
}

/** Creates a zeroed verifier accumulator for graph identity integrity pages. */
const emptyGraphIdentityIntegrity = (): GraphIdentityIntegrityTotal => ({
  checkedRefs: 0,
  checkedRefInputs: 0,
  firstInvalidRefInput: null,
  firstMissingGraph: null,
  firstMismatchedContentId: null,
  firstRouteShapedContentId: null,
  invalidRefInputs: 0,
  missingGraphRows: 0,
  mismatchedContentIds: 0,
  routeShapedContentIds: 0,
  scannedRows: 0,
});

/** Adds one target page into the aggregate graph identity verifier totals. */
function addGraphIdentityPage(
  total: GraphIdentityIntegrityTotal,
  page: GraphIdentityIntegrityTotal
) {
  total.checkedRefs += page.checkedRefs;
  total.checkedRefInputs += page.checkedRefInputs;
  total.missingGraphRows += page.missingGraphRows;
  total.mismatchedContentIds += page.mismatchedContentIds;
  total.invalidRefInputs += page.invalidRefInputs;
  total.routeShapedContentIds += page.routeShapedContentIds;
  total.scannedRows += page.scannedRows;
  total.firstInvalidRefInput ??= page.firstInvalidRefInput;
  total.firstMissingGraph ??= page.firstMissingGraph;
  total.firstMismatchedContentId ??= page.firstMismatchedContentId;
  total.firstRouteShapedContentId ??= page.firstRouteShapedContentId;
}

/** Reads all integrity pages for one graph identity target and totals them. */
const getGraphIdentityIntegrityForTarget = Effect.fn(
  "sync.getGraphIdentityIntegrityForTarget"
)(function* (config: ConvexConfig, target: GraphIdentityTarget) {
  const total = emptyGraphIdentityIntegrity();
  let continueCursor: string | null = null;
  let isDone = false;

  while (!isDone) {
    const page: GraphIdentityIntegrityPage = yield* callConvexQuery(
      config,
      internal.contentSync.queries.integrity.getGraphIdentityIntegrityPage,
      {
        paginationOpts: {
          cursor: continueCursor,
          numItems: getGraphIdentityPageSize(target),
        },
        target,
      },
      GraphIdentityIntegrityPageSchema
    );

    addGraphIdentityPage(total, page);
    continueCursor = page.continueCursor;
    isDone = page.isDone;
  }

  return total;
});

/** Finds database content rows whose source slugs are no longer on disk. */
export const getStaleContent = Effect.fn("sync.getStaleContent")(function* (
  config: ConvexConfig,
  filesystemSlugs: FilesystemSlugs
) {
  const articleSlugSet = new Set(filesystemSlugs.articleSlugs);
  const curriculumTopicSlugSet = new Set(filesystemSlugs.curriculumTopicSlugs);
  const curriculumLessonSlugSet = new Set(
    filesystemSlugs.curriculumLessonSlugs
  );
  const exerciseSetSlugSet = new Set(filesystemSlugs.exerciseSetSlugs);
  const exerciseQuestionSlugSet = new Set(
    filesystemSlugs.exerciseQuestionSlugs
  );
  const [
    articles,
    curriculumTopics,
    curriculumLessons,
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
      buildStaleContentArgs("curriculumTopics"),
      StaleContentPageSchema
    ),
    collectPages(
      config,
      internal.contentSync.queries.stale.listStaleContentPage,
      buildStaleContentArgs("curriculumLessons"),
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
    staleCurriculumTopics: curriculumTopics.filter(
      (item) => !curriculumTopicSlugSet.has(item.slug)
    ),
    staleCurriculumLessons: curriculumLessons.filter(
      (item) => !curriculumLessonSlugSet.has(item.slug)
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
      internal.contentSync.queries.integrity.listIntegrityCurriculumLessonsPage,
      (paginationOpts) => ({ paginationOpts }),
      CurriculumLessonIntegrityPageSchema
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
      .filter((authorLink) => authorLink.contentType === "material")
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

/** Summarizes graph identity violations across persisted read models and chat previews. */
export const getGraphIdentityIntegrity = Effect.fn(
  "sync.getGraphIdentityIntegrity"
)(function* (config: ConvexConfig) {
  const total = emptyGraphIdentityIntegrity();

  for (const target of GRAPH_IDENTITY_TARGETS) {
    addGraphIdentityPage(
      total,
      yield* getGraphIdentityIntegrityForTarget(config, target)
    );
  }

  return Schema.decodeUnknownSync(GraphIdentityIntegritySchema)(total);
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
