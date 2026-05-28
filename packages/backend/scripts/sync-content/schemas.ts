import { CONTENT_SYNC_BATCH_LIMITS } from "@repo/backend/confect/modules/content/constants";
import {
  localeSchema,
  SUPPORTED_CONTENT_LOCALES,
} from "@repo/backend/confect/modules/content/content.schemas";
import { Effect, Schema } from "effect";

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
  return yield* Schema.decodeUnknown(localeSchema)(value).pipe(
    Effect.mapError(
      () =>
        new SyncLocaleParseError({
          message: `Invalid locale "${value}" in ${context}. Expected: ${SUPPORTED_CONTENT_LOCALES.join(", ")}`,
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

const StaleItemSchema = Schema.Struct({
  id: Schema.String,
  slug: Schema.String,
  locale: localeSchema,
});

export const StaleContentSchema = Schema.Struct({
  staleArticles: Schema.Array(StaleItemSchema),
  staleSubjectTopics: Schema.Array(StaleItemSchema),
  staleSubjectSections: Schema.Array(StaleItemSchema),
  staleExerciseSets: Schema.Array(StaleItemSchema),
  staleExerciseQuestions: Schema.Array(StaleItemSchema),
});
