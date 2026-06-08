import type { Id, TableNames } from "@repo/backend/convex/_generated/dataModel";
import { CONTENT_SYNC_BATCH_LIMITS } from "@repo/backend/convex/contentSync/constants";
import { locales } from "@repo/utilities/locales";
import { Effect, Schema } from "effect";

const SyncLocaleSchema = Schema.Literal(...locales);

/** Validates a Convex document ID while preserving its generated table brand. */
export const ConvexIdSchema = <const TableName extends TableNames>(
  tableName: TableName
) =>
  Schema.String.pipe(
    Schema.filter((value): value is Id<TableName> => value.length > 0, {
      message: () => `Expected ${tableName} document ID`,
    })
  );

const ContentIdSchema = Schema.Union(
  ConvexIdSchema("articleContents"),
  ConvexIdSchema("subjectSections"),
  ConvexIdSchema("exerciseQuestions")
);

/** Builds a decoded mutable array schema for generated Convex return types. */
export const mutableArraySchema = <A, I>(schema: Schema.Schema<A, I, never>) =>
  Schema.mutable(Schema.Array(schema));

export const BATCH_SIZES = {
  articles: CONTENT_SYNC_BATCH_LIMITS.articles,
  authors: CONTENT_SYNC_BATCH_LIMITS.authors,
  subjectTopics: CONTENT_SYNC_BATCH_LIMITS.subjectTopics,
  subjectSections: CONTENT_SYNC_BATCH_LIMITS.subjectSections,
  exerciseSets: CONTENT_SYNC_BATCH_LIMITS.exerciseSets,
  exerciseQuestions: CONTENT_SYNC_BATCH_LIMITS.exerciseQuestions,
  quranSearchDocuments: CONTENT_SYNC_BATCH_LIMITS.quranSearchDocuments,
  staleArticles: CONTENT_SYNC_BATCH_LIMITS.staleArticles,
  staleSubjectTopics: CONTENT_SYNC_BATCH_LIMITS.staleSubjectTopics,
  staleSubjectSections: CONTENT_SYNC_BATCH_LIMITS.staleSubjectSections,
  staleExerciseSets: CONTENT_SYNC_BATCH_LIMITS.staleExerciseSets,
  staleExerciseQuestions: CONTENT_SYNC_BATCH_LIMITS.staleExerciseQuestions,
  unusedAuthors: CONTENT_SYNC_BATCH_LIMITS.unusedAuthors,
} as const;

export const LOCALE_MATERIAL_FILE_REGEX = /\/([a-z]{2})-material\.ts$/;
export const LOCALE_SUBJECT_MATERIAL_FILE_REGEX = /\/([a-z]{2})-material\.ts$/;

/** Identifies an unsupported locale segment while parsing script inputs. */
export class SyncLocaleParseError extends Schema.TaggedError<SyncLocaleParseError>()(
  "SyncLocaleParseError",
  {
    message: Schema.String,
  }
) {}

/** Parses one CLI locale flag into the supported Convex content locale. */
export const parseLocale = Effect.fn("sync.parseLocale")(function* (
  value: string,
  context: string
) {
  return yield* Schema.decodeUnknown(SyncLocaleSchema)(value).pipe(
    Effect.mapError(
      () =>
        new SyncLocaleParseError({
          message: `Invalid locale "${value}" in ${context}. Expected: ${locales.join(", ")}`,
        })
    )
  );
});

export const SyncStateSchema = Schema.Struct({
  lastSyncTimestamp: Schema.Number,
  lastSyncCommit: Schema.String,
});

export const ConvexAuthConfigSchema = Schema.Struct({
  accessToken: Schema.optional(Schema.String),
});

export const ConvexResponseSchema = Schema.Struct({
  status: Schema.Literal("success", "error"),
  value: Schema.optional(Schema.Unknown),
  errorMessage: Schema.optional(Schema.String),
  logLines: Schema.optional(Schema.Array(Schema.String)),
});

export const SyncSummarySchema = Schema.Struct({
  created: Schema.Number,
  updated: Schema.Number,
  unchanged: Schema.Number,
});

export const ArticleSyncResultSchema = Schema.Struct({
  authorLinksCreated: Schema.Number,
  created: Schema.Number,
  referencesCreated: Schema.Number,
  unchanged: Schema.Number,
  updated: Schema.Number,
});

export const SubjectSectionSyncResultSchema = Schema.mutable(
  Schema.Struct({
    authorLinksCreated: Schema.Number,
    created: Schema.Number,
    skipped: Schema.Number,
    skippedTopicSlugs: mutableArraySchema(Schema.String),
    unchanged: Schema.Number,
    updated: Schema.Number,
  })
);

export const ExerciseQuestionSyncResultSchema = Schema.mutable(
  Schema.Struct({
    authorLinksCreated: Schema.Number,
    choicesCreated: Schema.Number,
    created: Schema.Number,
    skipped: Schema.Number,
    skippedSetSlugs: mutableArraySchema(Schema.String),
    unchanged: Schema.Number,
    updated: Schema.Number,
  })
);

export const QuranSearchSyncResultSchema = SyncSummarySchema;

export const TryoutSyncResultSchema = SyncSummarySchema;

export const ExerciseSetSyncResultSchema = SyncSummarySchema;

export const SubjectTopicSyncResultSchema = SyncSummarySchema;

export const AuthorSyncResultSchema = Schema.Struct({
  created: Schema.Number,
  existing: Schema.Number,
});

export const ContentCountsSchema = Schema.Struct({
  articleReferences: Schema.Number,
  articles: Schema.Number,
  audioContentSources: Schema.Number,
  audioGenerationQueue: Schema.Number,
  authors: Schema.Number,
  contentAudios: Schema.Number,
  contentAuthors: Schema.Number,
  contentSearch: Schema.Number,
  exerciseAnswers: Schema.Number,
  exerciseAttempts: Schema.Number,
  exerciseChoices: Schema.Number,
  exerciseItemParameters: Schema.Number,
  exerciseQuestions: Schema.Number,
  exerciseSets: Schema.Number,
  irtCalibrationAttempts: Schema.Number,
  irtCalibrationCacheStats: Schema.Number,
  irtCalibrationQueue: Schema.Number,
  irtCalibrationRuns: Schema.Number,
  irtScalePublicationQueue: Schema.Number,
  irtScaleQualityChecks: Schema.Number,
  irtScaleQualityRefreshQueue: Schema.Number,
  irtScaleVersionItems: Schema.Number,
  irtScaleVersions: Schema.Number,
  subjectSections: Schema.Number,
  subjectTopics: Schema.Number,
  tryoutAccessCampaignProducts: Schema.Number,
  tryoutAccessCampaigns: Schema.Number,
  tryoutAccessGrants: Schema.Number,
  tryoutAccessLinks: Schema.Number,
  tryoutAttempts: Schema.Number,
  tryoutCatalogMeta: Schema.Number,
  tryoutLeaderboardEntries: Schema.Number,
  tryoutPartAttempts: Schema.Number,
  tryoutPartSets: Schema.Number,
  tryouts: Schema.Number,
  userTryoutEntitlements: Schema.Number,
  userTryoutStats: Schema.Number,
});

export const DataIntegritySchema = Schema.Struct({
  questionsWithoutChoices: Schema.Array(Schema.String),
  questionsWithoutAuthors: Schema.Array(Schema.String),
  articlesWithoutReferences: Schema.Array(Schema.String),
  sectionsWithoutTopics: Schema.Array(Schema.String),
  activeTryoutsWithoutScale: Schema.Array(Schema.String),
  totalQuestions: Schema.Number,
  totalArticles: Schema.Number,
  totalSections: Schema.Number,
});

export const TryoutScaleIntegritySchema = Schema.mutable(
  Schema.Struct({
    continueCursor: Schema.String,
    isDone: Schema.Boolean,
    page: mutableArraySchema(
      Schema.Struct({
        cycleKey: Schema.String,
        locale: SyncLocaleSchema,
        product: Schema.Literal("snbt"),
        slug: Schema.String,
      })
    ),
  })
);

const StaleItemSchema = Schema.Struct({
  id: Schema.Union(
    ConvexIdSchema("articleContents"),
    ConvexIdSchema("subjectTopics"),
    ConvexIdSchema("subjectSections"),
    ConvexIdSchema("exerciseSets"),
    ConvexIdSchema("exerciseQuestions")
  ),
  slug: Schema.String,
  locale: SyncLocaleSchema,
});

const StaleArticleSchema = Schema.Struct({
  id: ConvexIdSchema("articleContents"),
  slug: Schema.String,
  locale: SyncLocaleSchema,
});

const StaleSubjectTopicSchema = Schema.Struct({
  id: ConvexIdSchema("subjectTopics"),
  slug: Schema.String,
  locale: SyncLocaleSchema,
});

const StaleSubjectSectionSchema = Schema.Struct({
  id: ConvexIdSchema("subjectSections"),
  slug: Schema.String,
  locale: SyncLocaleSchema,
});

const StaleExerciseSetSchema = Schema.Struct({
  id: ConvexIdSchema("exerciseSets"),
  slug: Schema.String,
  locale: SyncLocaleSchema,
});

const StaleExerciseQuestionSchema = Schema.Struct({
  id: ConvexIdSchema("exerciseQuestions"),
  slug: Schema.String,
  locale: SyncLocaleSchema,
});

const PaginationPageSchema = Schema.Struct({
  continueCursor: Schema.String,
  isDone: Schema.Boolean,
});

export const StaleContentSchema = Schema.Struct({
  staleArticles: Schema.Array(StaleArticleSchema),
  staleSubjectTopics: Schema.Array(StaleSubjectTopicSchema),
  staleSubjectSections: Schema.Array(StaleSubjectSectionSchema),
  staleExerciseSets: Schema.Array(StaleExerciseSetSchema),
  staleExerciseQuestions: Schema.Array(StaleExerciseQuestionSchema),
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

export const ExerciseQuestionIntegrityPageSchema = Schema.mutable(
  Schema.extend(
    PaginationPageSchema,
    Schema.Struct({
      page: mutableArraySchema(
        Schema.Struct({
          id: ConvexIdSchema("exerciseQuestions"),
          locale: SyncLocaleSchema,
          slug: Schema.String,
        })
      ),
    })
  )
);

export const ExerciseChoiceIntegrityPageSchema = Schema.mutable(
  Schema.extend(
    PaginationPageSchema,
    Schema.Struct({
      page: mutableArraySchema(
        Schema.Struct({
          questionId: ConvexIdSchema("exerciseQuestions"),
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
          contentType: Schema.Literal("article", "subject", "exercise"),
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

export const SubjectSectionIntegrityPageSchema = Schema.mutable(
  Schema.extend(
    PaginationPageSchema,
    Schema.Struct({
      page: mutableArraySchema(
        Schema.Struct({
          locale: SyncLocaleSchema,
          slug: Schema.String,
          topicId: Schema.optional(ConvexIdSchema("subjectTopics")),
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
