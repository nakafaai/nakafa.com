import { CONTENT_SYNC_BATCH_LIMITS } from "@repo/backend/convex/contentSync/constants";
import { locales } from "@repo/utilities/locales";
import { Effect, Schema } from "effect";

const SyncLocaleSchema = Schema.Literal(...locales);

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

export const SyncResultSchema = Schema.Struct({
  created: Schema.Number,
  updated: Schema.Number,
  unchanged: Schema.Number,
  referencesCreated: Schema.optional(Schema.Number),
  choicesCreated: Schema.optional(Schema.Number),
  authorLinksCreated: Schema.optional(Schema.Number),
  skipped: Schema.optional(Schema.Number),
  skippedSetSlugs: Schema.optional(Schema.Array(Schema.String)),
});

export const AuthorSyncResultSchema = Schema.Struct({
  created: Schema.Number,
  existing: Schema.Number,
});

export const ContentCountsSchema = Schema.Struct({
  articles: Schema.Number,
  subjectTopics: Schema.Number,
  subjectSections: Schema.Number,
  exerciseSets: Schema.Number,
  exerciseQuestions: Schema.Number,
  exerciseAttempts: Schema.Number,
  exerciseAnswers: Schema.Number,
  tryoutAccessCampaigns: Schema.Number,
  tryoutAccessCampaignProducts: Schema.Number,
  tryoutAccessLinks: Schema.Number,
  tryoutAccessGrants: Schema.Number,
  tryouts: Schema.Number,
  tryoutCatalogMeta: Schema.Number,
  userTryoutEntitlements: Schema.Number,
  tryoutPartSets: Schema.Number,
  tryoutAttempts: Schema.Number,
  tryoutPartAttempts: Schema.Number,
  tryoutLeaderboardEntries: Schema.Number,
  userTryoutStats: Schema.Number,
  irtCalibrationQueue: Schema.Number,
  irtCalibrationAttempts: Schema.Number,
  irtCalibrationCacheStats: Schema.Number,
  irtCalibrationRuns: Schema.Number,
  irtScaleQualityChecks: Schema.Number,
  irtScaleQualityRefreshQueue: Schema.Number,
  exerciseItemParameters: Schema.Number,
  irtScalePublicationQueue: Schema.Number,
  irtScaleVersions: Schema.Number,
  irtScaleVersionItems: Schema.Number,
  contentSearch: Schema.Number,
  authors: Schema.Number,
  contentAuthors: Schema.Number,
  articleReferences: Schema.Number,
  exerciseChoices: Schema.Number,
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

export const TryoutScaleIntegritySchema = Schema.Struct({
  continueCursor: Schema.String,
  isDone: Schema.Boolean,
  page: Schema.Array(
    Schema.Struct({
      cycleKey: Schema.String,
      locale: SyncLocaleSchema,
      product: Schema.String,
      slug: Schema.String,
    })
  ),
});

const StaleItemSchema = Schema.Struct({
  id: Schema.String,
  slug: Schema.String,
  locale: SyncLocaleSchema,
});

const PaginationPageSchema = Schema.Struct({
  continueCursor: Schema.String,
  isDone: Schema.Boolean,
});

export const StaleContentSchema = Schema.Struct({
  staleArticles: Schema.Array(StaleItemSchema),
  staleSubjectTopics: Schema.Array(StaleItemSchema),
  staleSubjectSections: Schema.Array(StaleItemSchema),
  staleExerciseSets: Schema.Array(StaleItemSchema),
  staleExerciseQuestions: Schema.Array(StaleItemSchema),
});

export const StaleContentPageSchema = Schema.extend(
  PaginationPageSchema,
  Schema.Struct({
    page: Schema.Array(StaleItemSchema),
  })
);

export const ExerciseQuestionIntegrityPageSchema = Schema.extend(
  PaginationPageSchema,
  Schema.Struct({
    page: Schema.Array(StaleItemSchema),
  })
);

export const ExerciseChoiceIntegrityPageSchema = Schema.extend(
  PaginationPageSchema,
  Schema.Struct({
    page: Schema.Array(
      Schema.Struct({
        questionId: Schema.String,
      })
    ),
  })
);

export const ContentAuthorIntegrityPageSchema = Schema.extend(
  PaginationPageSchema,
  Schema.Struct({
    page: Schema.Array(
      Schema.Struct({
        authorId: Schema.String,
        contentId: Schema.String,
        contentType: Schema.Literal("article", "subject", "exercise"),
      })
    ),
  })
);

export const ArticleReferenceIntegrityPageSchema = Schema.extend(
  PaginationPageSchema,
  Schema.Struct({
    page: Schema.Array(
      Schema.Struct({
        articleId: Schema.String,
      })
    ),
  })
);

export const SubjectSectionIntegrityPageSchema = Schema.extend(
  PaginationPageSchema,
  Schema.Struct({
    page: Schema.Array(
      Schema.Struct({
        locale: SyncLocaleSchema,
        slug: Schema.String,
        topicId: Schema.optional(Schema.String),
      })
    ),
  })
);

export const AuthorPageSchema = Schema.extend(
  PaginationPageSchema,
  Schema.Struct({
    page: Schema.Array(
      Schema.Struct({
        id: Schema.String,
        name: Schema.String,
        username: Schema.String,
      })
    ),
  })
);

export const UnusedAuthorsSchema = Schema.Struct({
  unusedAuthors: Schema.Array(
    Schema.Struct({
      id: Schema.String,
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
