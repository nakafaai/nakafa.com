import { internal } from "@repo/backend/convex/_generated/api";
import {
  ArticleIntegrityPageSchema,
  ArticleReferenceIntegrityPageSchema,
  AuthorPageSchema,
  ContentAuthorIntegrityPageSchema,
  CurriculumLessonIntegrityPageSchema,
  DataIntegritySchema,
  GraphIdentityIntegrityPageSchema,
  GraphIdentityIntegritySchema,
  QuestionChoiceIntegrityPageSchema,
  QuestionIntegrityPageSchema,
  StaleContentPageSchema,
  StaleContentSchema,
  TryoutScaleIntegrityPageSchema,
  UnusedAuthorsSchema,
} from "@repo/backend/scripts/sync-content/contract/schemas";
import type {
  ConvexConfig,
  FilesystemSlugs,
} from "@repo/backend/scripts/sync-content/contract/types";
import { callConvexQuery } from "@repo/backend/scripts/sync-content/convex/client";
import type {
  DefaultFunctionArgs,
  FunctionArgs,
  FunctionReference,
  FunctionReturnType,
} from "convex/server";
import { Effect, Schema } from "effect";

const PAGE_SIZE = 1000;
/** Graph-backed tables that must have a matching graph identity after sync. */
export const GRAPH_IDENTITY_TARGETS = [
  "contentRoutes",
  "contentSearch",
  "contentRoutePages",
  "messageParts",
  "learningViews",
  "learningEngagementQueue",
  "userLearningRecents",
  "learningPopularityViewerSignals",
  "learningPopularitySignals",
  "learningPopularityCounters",
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

  if (target === "messageParts") {
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
  const questionSetSourcePathSet = new Set(
    filesystemSlugs.questionSetSourcePaths
  );
  const questionSourceKeySet = new Set(filesystemSlugs.questionSourceKeys);
  const tryoutCountryPathSet = new Set(filesystemSlugs.tryoutCountryPaths);
  const tryoutExamPathSet = new Set(filesystemSlugs.tryoutExamPaths);
  const tryoutTrackPathSet = new Set(filesystemSlugs.tryoutTrackPaths);
  const tryoutSetPathSet = new Set(filesystemSlugs.tryoutSetPaths);
  const tryoutSectionPathSet = new Set(filesystemSlugs.tryoutSectionPaths);
  const [
    articles,
    curriculumTopics,
    curriculumLessons,
    questionSets,
    questions,
    tryoutCountries,
    tryoutExams,
    tryoutTracks,
    tryoutSets,
    tryoutSections,
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
      buildStaleContentArgs("questionSets"),
      StaleContentPageSchema
    ),
    collectPages(
      config,
      internal.contentSync.queries.stale.listStaleContentPage,
      buildStaleContentArgs("questions"),
      StaleContentPageSchema
    ),
    collectPages(
      config,
      internal.contentSync.queries.stale.listStaleContentPage,
      buildStaleContentArgs("tryoutCountries"),
      StaleContentPageSchema
    ),
    collectPages(
      config,
      internal.contentSync.queries.stale.listStaleContentPage,
      buildStaleContentArgs("tryoutExams"),
      StaleContentPageSchema
    ),
    collectPages(
      config,
      internal.contentSync.queries.stale.listStaleContentPage,
      buildStaleContentArgs("tryoutTracks"),
      StaleContentPageSchema
    ),
    collectPages(
      config,
      internal.contentSync.queries.stale.listStaleContentPage,
      buildStaleContentArgs("tryoutSets"),
      StaleContentPageSchema
    ),
    collectPages(
      config,
      internal.contentSync.queries.stale.listStaleContentPage,
      buildStaleContentArgs("tryoutSections"),
      StaleContentPageSchema
    ),
  ]);

  return Schema.decodeUnknownSync(StaleContentSchema)({
    staleArticles: articles.filter(
      (item) => !articleSlugSet.has(item.sourcePath)
    ),
    staleCurriculumTopics: curriculumTopics.filter(
      (item) => !curriculumTopicSlugSet.has(item.sourcePath)
    ),
    staleCurriculumLessons: curriculumLessons.filter(
      (item) => !curriculumLessonSlugSet.has(item.sourcePath)
    ),
    staleQuestionSets: questionSets.filter(
      (item) => !questionSetSourcePathSet.has(item.sourcePath)
    ),
    staleQuestions: questions.filter(
      (item) => !questionSourceKeySet.has(getQuestionSourceKey(item))
    ),
    staleTryoutCountries: tryoutCountries.filter(
      (item) => !tryoutCountryPathSet.has(item.sourcePath)
    ),
    staleTryoutExams: tryoutExams.filter(
      (item) => !tryoutExamPathSet.has(item.sourcePath)
    ),
    staleTryoutTracks: tryoutTracks.filter(
      (item) => !tryoutTrackPathSet.has(item.sourcePath)
    ),
    staleTryoutSets: tryoutSets.filter(
      (item) => !tryoutSetPathSet.has(item.sourcePath)
    ),
    staleTryoutSections: tryoutSections.filter(
      (item) => !tryoutSectionPathSet.has(item.sourcePath)
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
    tryoutScales,
  ] = yield* Effect.all([
    collectPages(
      config,
      internal.contentSync.queries.integrity.listIntegrityQuestionsPage,
      (paginationOpts) => ({ paginationOpts }),
      QuestionIntegrityPageSchema
    ),
    collectPages(
      config,
      internal.contentSync.queries.integrity.listIntegrityQuestionChoicesPage,
      (paginationOpts) => ({ paginationOpts }),
      QuestionChoiceIntegrityPageSchema
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
      internal.contentSync.queries.integrity.listIntegrityTryoutScalesPage,
      (paginationOpts) => ({ paginationOpts }),
      TryoutScaleIntegrityPageSchema
    ),
  ]);
  const questionIdsWithChoices = new Set(
    choices.map((choice) => choice.questionId)
  );
  const questionIdsWithAuthors = new Set(
    contentAuthors
      .filter((authorLink) => authorLink.contentType === "question")
      .map((authorLink) => authorLink.contentId)
  );
  const articleIdsWithReferences = new Set(
    references.map((reference) => reference.articleId)
  );

  return Schema.decodeUnknownSync(DataIntegritySchema)({
    questionsWithoutChoices: questions
      .filter((question) => !questionIdsWithChoices.has(question.id))
      .map((question) => `${question.sourcePath} (${question.locale})`),
    questionsWithoutAuthors: questions
      .filter((question) => !questionIdsWithAuthors.has(question.id))
      .map((question) => `${question.sourcePath} (${question.locale})`),
    articlesWithoutReferences: articles
      .filter((article) => !articleIdsWithReferences.has(article.id))
      .map((article) => `${article.sourcePath} (${article.locale})`),
    sectionsWithoutTopics: sections
      .filter((section) => !section.topicId)
      .map((section) => `${section.slug} (${section.locale})`),
    activeTryoutsWithoutScale: tryoutScales
      .filter(
        (set) =>
          set.isActive &&
          set.scoringStrategy === "irt" &&
          !set.hasPublishedScale
      )
      .map((set) => `${set.publicPath} (${set.locale})`),
    totalQuestions: questions.length,
    totalArticles: articles.length,
    totalSections: sections.length,
  });
});

/** Builds the locale-qualified source key for one persisted question row. */
function getQuestionSourceKey(item: { locale: string; sourcePath: string }) {
  return `${item.locale}:${item.sourcePath}`;
}

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

/** Returns authors that have no content-author links after sync. */
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
