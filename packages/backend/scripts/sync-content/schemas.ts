import type { Locale } from "@repo/backend/convex/lib/validators/contents";
import * as z from "zod";
import { CONTENT_SYNC_BATCH_LIMITS } from "../../convex/contentSync/constants";

export const BATCH_SIZES = {
  articles: CONTENT_SYNC_BATCH_LIMITS.articles,
  authors: CONTENT_SYNC_BATCH_LIMITS.authors,
  subjectTopics: CONTENT_SYNC_BATCH_LIMITS.subjectTopics,
  subjectSections: CONTENT_SYNC_BATCH_LIMITS.subjectSections,
  exerciseSets: CONTENT_SYNC_BATCH_LIMITS.exerciseSets,
  exerciseQuestions: CONTENT_SYNC_BATCH_LIMITS.exerciseQuestions,
  staleArticles: CONTENT_SYNC_BATCH_LIMITS.staleArticles,
  staleSubjectTopics: CONTENT_SYNC_BATCH_LIMITS.staleSubjectTopics,
  staleSubjectSections: CONTENT_SYNC_BATCH_LIMITS.staleSubjectSections,
  staleExerciseSets: CONTENT_SYNC_BATCH_LIMITS.staleExerciseSets,
  staleExerciseQuestions: CONTENT_SYNC_BATCH_LIMITS.staleExerciseQuestions,
  unusedAuthors: CONTENT_SYNC_BATCH_LIMITS.unusedAuthors,
} as const;

export const LOCALE_MATERIAL_FILE_REGEX = /\/([a-z]{2})-material\.ts$/;
export const LOCALE_SUBJECT_MATERIAL_FILE_REGEX = /\/([a-z]{2})-material\.ts$/;

const LocaleSchema = z.union([z.literal("en"), z.literal("id")]);

export const parseLocale = (value: string, context: string): Locale => {
  const result = LocaleSchema.safeParse(value);
  if (!result.success) {
    throw new Error(
      `Invalid locale "${value}" in ${context}. Expected: en, id`
    );
  }
  return result.data;
};

export const SyncStateSchema = z.object({
  lastSyncTimestamp: z.number(),
  lastSyncCommit: z.string(),
});

export const ConvexAuthConfigSchema = z.object({
  accessToken: z.string().optional(),
});

export const ConvexResponseSchema = z.object({
  status: z.string(),
  value: z.unknown().optional(),
  errorMessage: z.string().optional(),
  logLines: z.array(z.string()).optional(),
});

export const SyncResultSchema = z.object({
  created: z.number(),
  updated: z.number(),
  unchanged: z.number(),
  referencesCreated: z.number().optional(),
  choicesCreated: z.number().optional(),
  authorLinksCreated: z.number().optional(),
  skipped: z.number().optional(),
  skippedSetSlugs: z.array(z.string()).optional(),
});

export const AuthorSyncResultSchema = z.object({
  created: z.number(),
  existing: z.number(),
});

export const ContentCountsSchema = z.object({
  articles: z.number(),
  subjectTopics: z.number(),
  subjectSections: z.number(),
  exerciseSets: z.number(),
  exerciseQuestions: z.number(),
  exerciseAttempts: z.number(),
  exerciseAnswers: z.number(),
  tryouts: z.number(),
  tryoutCatalogEntries: z.number(),
  tryoutCatalogMeta: z.number(),
  userTryoutAccessSources: z.number(),
  userTryoutCompetitionUsages: z.number(),
  tryoutPartSets: z.number(),
  tryoutAttempts: z.number(),
  tryoutPartAttempts: z.number(),
  tryoutLeaderboardEntries: z.number(),
  userTryoutLatestAttempts: z.number(),
  userTryoutStats: z.number(),
  irtCalibrationQueue: z.number(),
  irtCalibrationAttempts: z.number(),
  irtCalibrationCacheStats: z.number(),
  irtCalibrationRuns: z.number(),
  irtScaleQualityChecks: z.number(),
  irtScaleQualityRefreshQueue: z.number(),
  exerciseItemParameters: z.number(),
  irtScalePublicationQueue: z.number(),
  irtScaleVersions: z.number(),
  irtScaleVersionItems: z.number(),
  authors: z.number(),
  contentAuthors: z.number(),
  articleReferences: z.number(),
  exerciseChoices: z.number(),
});

export const DataIntegritySchema = z.object({
  questionsWithoutChoices: z.array(z.string()),
  questionsWithoutAuthors: z.array(z.string()),
  articlesWithoutReferences: z.array(z.string()),
  sectionsWithoutTopics: z.array(z.string()),
  activeTryoutsWithoutScale: z.array(z.string()),
  totalQuestions: z.number(),
  totalArticles: z.number(),
  totalSections: z.number(),
});

export const TryoutScaleIntegritySchema = z.object({
  activeTryoutsWithoutScale: z.array(
    z.object({
      cycleKey: z.string(),
      locale: z.enum(["en", "id"]),
      product: z.string(),
      slug: z.string(),
    })
  ),
});

const StaleItemSchema = z.object({
  id: z.string(),
  slug: z.string(),
  locale: z.enum(["en", "id"]),
});

const PaginationPageSchema = z.object({
  continueCursor: z.string(),
  isDone: z.boolean(),
});

export const StaleContentSchema = z.object({
  staleArticles: z.array(StaleItemSchema),
  staleSubjectTopics: z.array(StaleItemSchema),
  staleSubjectSections: z.array(StaleItemSchema),
  staleExerciseSets: z.array(StaleItemSchema),
  staleExerciseQuestions: z.array(StaleItemSchema),
});

export const StaleContentPageSchema = PaginationPageSchema.extend({
  page: z.array(StaleItemSchema),
});

export const ExerciseQuestionIntegrityPageSchema = PaginationPageSchema.extend({
  page: z.array(StaleItemSchema),
});

export const ExerciseChoiceIntegrityPageSchema = PaginationPageSchema.extend({
  page: z.array(
    z.object({
      questionId: z.string(),
    })
  ),
});

export const ContentAuthorIntegrityPageSchema = PaginationPageSchema.extend({
  page: z.array(
    z.object({
      authorId: z.string(),
      contentId: z.string(),
      contentType: z.enum(["article", "subject", "exercise"]),
    })
  ),
});

export const ArticleReferenceIntegrityPageSchema = PaginationPageSchema.extend({
  page: z.array(
    z.object({
      articleId: z.string(),
    })
  ),
});

export const SubjectSectionIntegrityPageSchema = PaginationPageSchema.extend({
  page: z.array(
    z.object({
      locale: z.enum(["en", "id"]),
      slug: z.string(),
      topicId: z.string().optional(),
    })
  ),
});

export const AuthorPageSchema = PaginationPageSchema.extend({
  page: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      username: z.string(),
    })
  ),
});

export const UnusedAuthorsSchema = z.object({
  unusedAuthors: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      username: z.string(),
    })
  ),
});

export const DeleteResultSchema = z.object({
  deleted: z.number(),
});

export const BatchDeleteResultSchema = z.object({
  deleted: z.number(),
  hasMore: z.boolean(),
});

export const CountTablePageSchema = z.object({
  continueCursor: z.string(),
  isDone: z.boolean(),
  pageSize: z.number(),
});
