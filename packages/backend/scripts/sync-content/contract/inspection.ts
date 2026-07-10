import { NAKAFA_CONTENT_SECTIONS } from "@repo/backend/convex/contents/constants";
import { CONTENT_TYPE_VALUES } from "@repo/backend/convex/lib/validators/contents";
import {
  ConvexIdSchema,
  mutableArraySchema,
} from "@repo/backend/scripts/sync-content/contract/schemas";
import { TryoutScoringStrategySchema } from "@repo/contents/_types/tryout/schema";
import { locales } from "@repo/utilities/locales";
import { Schema } from "effect";

const SyncLocaleSchema = Schema.Literal(...locales);
const SyncSectionSchema = Schema.Literal(...NAKAFA_CONTENT_SECTIONS);
const ContentTypeSchema = Schema.Literal(...CONTENT_TYPE_VALUES);
const ContentIdSchema = Schema.Union(
  ConvexIdSchema("articleContents"),
  ConvexIdSchema("curriculumLessons"),
  ConvexIdSchema("questions")
);

/** Counts every read-model table inspected by cleanup and import verification. */
export const ContentCountsSchema = Schema.Struct({
  articleReferences: Schema.Number,
  articles: Schema.Number,
  audioContentSources: Schema.Number,
  audioGenerationQueue: Schema.Number,
  authors: Schema.Number,
  contentAnalyticsPartitions: Schema.Number,
  contentAudios: Schema.Number,
  contentAuthors: Schema.Number,
  contentRouteCounts: Schema.Number,
  contentRoutePages: Schema.Number,
  contentRoutes: Schema.Number,
  publicRoutes: Schema.Number,
  contentSearch: Schema.Number,
  learningEngagementQueue: Schema.Number,
  learningViews: Schema.Number,
  questionChoices: Schema.Number,
  questions: Schema.Number,
  questionSets: Schema.Number,
  irtCalibrationAttempts: Schema.Number,
  irtCalibrationCacheStats: Schema.Number,
  irtCalibrationQueue: Schema.Number,
  irtCalibrationRuns: Schema.Number,
  irtScalePublicationQueue: Schema.Number,
  irtScaleQualityChecks: Schema.Number,
  irtScaleQualityRefreshQueue: Schema.Number,
  irtScaleItems: Schema.Number,
  irtScaleVersions: Schema.Number,
  assessmentNodes: Schema.Number,
  assessments: Schema.Number,
  curricula: Schema.Number,
  curriculumMaterials: Schema.Number,
  curriculumNodes: Schema.Number,
  learningProgramCoverage: Schema.Number,
  learningPlanItems: Schema.Number,
  learningProgramSources: Schema.Number,
  learningPrograms: Schema.Number,
  learningPopularityCounters: Schema.Number,
  learningPopularitySignals: Schema.Number,
  learningPopularityViewerSignals: Schema.Number,
  materialLocales: Schema.Number,
  materials: Schema.Number,
  quranSurahs: Schema.Number,
  quranVerses: Schema.Number,
  curriculumLessons: Schema.Number,
  userLearningRecents: Schema.Number,
  curriculumTopics: Schema.Number,
  tryoutAccessCampaigns: Schema.Number,
  tryoutAccessTargets: Schema.Number,
  tryoutAccessGrants: Schema.Number,
  tryoutAccessLinks: Schema.Number,
  tryoutAttempts: Schema.Number,
  tryoutAttemptPlacements: Schema.Number,
  tryoutCountries: Schema.Number,
  tryoutExams: Schema.Number,
  tryoutLeaderboardEntries: Schema.Number,
  tryoutLeaderboardScopes: Schema.Number,
  tryoutLeaderboardUserStats: Schema.Number,
  tryoutResponses: Schema.Number,
  tryoutScores: Schema.Number,
  tryoutSectionAttempts: Schema.Number,
  tryoutSections: Schema.Number,
  tryoutSets: Schema.Number,
  tryoutTracks: Schema.Number,
  tryoutEntitlements: Schema.Number,
});

export const DataIntegritySchema = Schema.Struct({
  orphanQuestionChoiceIds: Schema.Array(Schema.String),
  questionsWithoutChoices: Schema.Array(Schema.String),
  questionsWithoutAuthors: Schema.Array(Schema.String),
  articlesWithoutReferences: Schema.Array(Schema.String),
  sectionsWithoutTopics: Schema.Array(Schema.String),
  activeTryoutsWithoutScale: Schema.Array(Schema.String),
  totalQuestions: Schema.Number,
  totalArticles: Schema.Number,
  totalSections: Schema.Number,
});

const GraphIdentityIssueSchema = Schema.Struct({
  assetId: Schema.optional(Schema.String),
  content_ref: Schema.optional(Schema.String),
  content_id: Schema.optional(Schema.String),
  kind: Schema.optional(Schema.String),
  route: Schema.optional(Schema.String),
  section: Schema.optional(SyncSectionSchema),
  status: Schema.optional(Schema.String),
});

export const GraphIdentityIntegrityPageSchema = Schema.Struct({
  checkedRefs: Schema.Number,
  checkedRefInputs: Schema.Number,
  continueCursor: Schema.String,
  firstInvalidRefInput: Schema.NullOr(GraphIdentityIssueSchema),
  firstMissingGraph: Schema.NullOr(GraphIdentityIssueSchema),
  firstMismatchedContentId: Schema.NullOr(GraphIdentityIssueSchema),
  firstRouteShapedContentId: Schema.NullOr(GraphIdentityIssueSchema),
  invalidRefInputs: Schema.Number,
  isDone: Schema.Boolean,
  missingGraphRows: Schema.Number,
  mismatchedContentIds: Schema.Number,
  routeShapedContentIds: Schema.Number,
  scannedRows: Schema.Number,
});

export const GraphIdentityIntegritySchema = Schema.Struct({
  checkedRefs: Schema.Number,
  checkedRefInputs: Schema.Number,
  firstInvalidRefInput: Schema.NullOr(GraphIdentityIssueSchema),
  firstMissingGraph: Schema.NullOr(GraphIdentityIssueSchema),
  firstMismatchedContentId: Schema.NullOr(GraphIdentityIssueSchema),
  firstRouteShapedContentId: Schema.NullOr(GraphIdentityIssueSchema),
  invalidRefInputs: Schema.Number,
  missingGraphRows: Schema.Number,
  mismatchedContentIds: Schema.Number,
  routeShapedContentIds: Schema.Number,
  scannedRows: Schema.Number,
});

const StaleItemSchema = Schema.Struct({
  id: Schema.Union(
    ConvexIdSchema("articleContents"),
    ConvexIdSchema("curriculumTopics"),
    ConvexIdSchema("curriculumLessons"),
    ConvexIdSchema("questionSets"),
    ConvexIdSchema("questions"),
    ConvexIdSchema("tryoutCountries"),
    ConvexIdSchema("tryoutExams"),
    ConvexIdSchema("tryoutTracks"),
    ConvexIdSchema("tryoutSets"),
    ConvexIdSchema("tryoutSections")
  ),
  locale: SyncLocaleSchema,
  sourcePath: Schema.String,
});

const StaleArticleSchema = Schema.Struct({
  id: ConvexIdSchema("articleContents"),
  locale: SyncLocaleSchema,
  sourcePath: Schema.String,
});

const StaleCurriculumTopicSchema = Schema.Struct({
  id: ConvexIdSchema("curriculumTopics"),
  locale: SyncLocaleSchema,
  sourcePath: Schema.String,
});

const StaleCurriculumLessonSchema = Schema.Struct({
  id: ConvexIdSchema("curriculumLessons"),
  locale: SyncLocaleSchema,
  sourcePath: Schema.String,
});

const StaleQuestionSetSchema = Schema.Struct({
  id: ConvexIdSchema("questionSets"),
  locale: SyncLocaleSchema,
  sourcePath: Schema.String,
});

const StaleQuestionSchema = Schema.Struct({
  id: ConvexIdSchema("questions"),
  locale: SyncLocaleSchema,
  sourcePath: Schema.String,
});

const StaleTryoutCountrySchema = Schema.Struct({
  id: ConvexIdSchema("tryoutCountries"),
  locale: SyncLocaleSchema,
  sourcePath: Schema.String,
});

const StaleTryoutExamSchema = Schema.Struct({
  id: ConvexIdSchema("tryoutExams"),
  locale: SyncLocaleSchema,
  sourcePath: Schema.String,
});

const StaleTryoutTrackSchema = Schema.Struct({
  id: ConvexIdSchema("tryoutTracks"),
  locale: SyncLocaleSchema,
  sourcePath: Schema.String,
});

const StaleTryoutSetSchema = Schema.Struct({
  id: ConvexIdSchema("tryoutSets"),
  locale: SyncLocaleSchema,
  sourcePath: Schema.String,
});

const StaleTryoutSectionSchema = Schema.Struct({
  id: ConvexIdSchema("tryoutSections"),
  locale: SyncLocaleSchema,
  sourcePath: Schema.String,
});

const PaginationPageSchema = Schema.Struct({
  continueCursor: Schema.String,
  isDone: Schema.Boolean,
});

export const StaleContentSchema = Schema.Struct({
  staleArticles: Schema.Array(StaleArticleSchema),
  staleCurriculumTopics: Schema.Array(StaleCurriculumTopicSchema),
  staleCurriculumLessons: Schema.Array(StaleCurriculumLessonSchema),
  staleQuestionSets: Schema.Array(StaleQuestionSetSchema),
  staleQuestions: Schema.Array(StaleQuestionSchema),
  staleTryoutCountries: Schema.Array(StaleTryoutCountrySchema),
  staleTryoutExams: Schema.Array(StaleTryoutExamSchema),
  staleTryoutSections: Schema.Array(StaleTryoutSectionSchema),
  staleTryoutSets: Schema.Array(StaleTryoutSetSchema),
  staleTryoutTracks: Schema.Array(StaleTryoutTrackSchema),
});

export const StaleContentPageSchema = Schema.mutable(
  Schema.extend(
    PaginationPageSchema,
    Schema.Struct({
      page: mutableArraySchema(StaleItemSchema),
    })
  )
);

export const ArticleIntegrityPageSchema = Schema.mutable(
  Schema.extend(
    PaginationPageSchema,
    Schema.Struct({
      page: mutableArraySchema(StaleArticleSchema),
    })
  )
);

export const QuestionIntegrityPageSchema = Schema.mutable(
  Schema.extend(
    PaginationPageSchema,
    Schema.Struct({
      page: mutableArraySchema(
        Schema.Struct({
          id: ConvexIdSchema("questions"),
          locale: SyncLocaleSchema,
          sourcePath: Schema.String,
        })
      ),
    })
  )
);

export const QuestionChoiceIntegrityPageSchema = Schema.mutable(
  Schema.extend(
    PaginationPageSchema,
    Schema.Struct({
      page: mutableArraySchema(
        Schema.Struct({
          questionId: ConvexIdSchema("questions"),
        })
      ),
    })
  )
);

export const ContentAuthorIntegrityPageSchema = Schema.mutable(
  Schema.extend(
    PaginationPageSchema,
    Schema.Struct({
      page: mutableArraySchema(
        Schema.Struct({
          authorId: ConvexIdSchema("authors"),
          contentId: ContentIdSchema,
          contentType: ContentTypeSchema,
        })
      ),
    })
  )
);

export const ArticleReferenceIntegrityPageSchema = Schema.mutable(
  Schema.extend(
    PaginationPageSchema,
    Schema.Struct({
      page: mutableArraySchema(
        Schema.Struct({
          articleId: ConvexIdSchema("articleContents"),
        })
      ),
    })
  )
);

export const CurriculumLessonIntegrityPageSchema = Schema.mutable(
  Schema.extend(
    PaginationPageSchema,
    Schema.Struct({
      page: mutableArraySchema(
        Schema.Struct({
          locale: SyncLocaleSchema,
          slug: Schema.String,
          topicId: Schema.optional(ConvexIdSchema("curriculumTopics")),
        })
      ),
    })
  )
);

export const TryoutScaleIntegrityPageSchema = Schema.mutable(
  Schema.extend(
    PaginationPageSchema,
    Schema.Struct({
      page: mutableArraySchema(
        Schema.Struct({
          id: ConvexIdSchema("tryoutSets"),
          isActive: Schema.Boolean,
          locale: SyncLocaleSchema,
          publicPath: Schema.String,
          scoringStrategy: TryoutScoringStrategySchema,
          hasPublishedScale: Schema.Boolean,
        })
      ),
    })
  )
);

export const AuthorPageSchema = Schema.mutable(
  Schema.extend(
    PaginationPageSchema,
    Schema.Struct({
      page: mutableArraySchema(
        Schema.Struct({
          id: ConvexIdSchema("authors"),
          name: Schema.String,
          username: Schema.String,
        })
      ),
    })
  )
);

export const UnusedAuthorsSchema = Schema.Struct({
  unusedAuthors: Schema.Array(
    Schema.Struct({
      id: ConvexIdSchema("authors"),
      name: Schema.String,
      username: Schema.String,
    })
  ),
});

export const DeleteResultSchema = Schema.Struct({
  deleted: Schema.Number,
});

export const BatchDeleteResultSchema = Schema.Struct({
  deleted: Schema.Number,
  hasMore: Schema.Boolean,
});

export const CountTablePageSchema = Schema.Struct({
  continueCursor: Schema.String,
  isDone: Schema.Boolean,
  pageSize: Schema.Number,
});
