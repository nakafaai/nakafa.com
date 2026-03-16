import type { Locale } from "@repo/backend/convex/lib/validators/contents";
import * as z from "zod";

export const BATCH_SIZES = {
  articles: 50,
  subjectTopics: 50,
  subjectSections: 20,
  exerciseSets: 50,
  exerciseQuestions: 30,
  staleExerciseSets: 5,
  staleExerciseQuestions: 100,
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
  tryoutPartSets: z.number(),
  tryoutAttempts: z.number(),
  tryoutPartAttempts: z.number(),
  tryoutLeaderboardEntries: z.number(),
  userTryoutStats: z.number(),
  irtCalibrationQueue: z.number(),
  irtCalibrationRuns: z.number(),
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
  totalQuestions: z.number(),
  totalArticles: z.number(),
  totalSections: z.number(),
});

const StaleItemSchema = z.object({
  id: z.string(),
  slug: z.string(),
  locale: z.enum(["en", "id"]),
});

export const StaleContentSchema = z.object({
  staleArticles: z.array(StaleItemSchema),
  staleSubjectTopics: z.array(StaleItemSchema),
  staleSubjectSections: z.array(StaleItemSchema),
  staleExerciseSets: z.array(StaleItemSchema),
  staleExerciseQuestions: z.array(StaleItemSchema),
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
