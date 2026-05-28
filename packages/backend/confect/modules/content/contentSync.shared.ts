import {
  ArticleContents,
  ArticleReferences,
} from "@repo/backend/confect/modules/content/articleContents.tables";
import {
  Authors,
  ContentAuthors,
} from "@repo/backend/confect/modules/content/authors.tables";
import { ContentSearch } from "@repo/backend/confect/modules/content/contents.tables";
import {
  ExerciseChoices,
  ExerciseQuestions,
} from "@repo/backend/confect/modules/content/exerciseQuestions.tables";
import { ExerciseSets } from "@repo/backend/confect/modules/content/exerciseSets.tables";
import { SubjectSections } from "@repo/backend/confect/modules/content/subjectSections.tables";
import { SubjectTopics } from "@repo/backend/confect/modules/content/subjectTopics.tables";
import {
  ExerciseAnswers,
  ExerciseAttempts,
} from "@repo/backend/confect/modules/learning/exercises.tables";
import {
  TryoutAccessCampaignProducts,
  TryoutAccessCampaigns,
  TryoutAccessGrants,
  TryoutAccessLinks,
  UserTryoutEntitlements,
} from "@repo/backend/confect/modules/tryout/access.tables";
import {
  ExerciseItemParameters,
  IrtCalibrationAttempts,
  IrtCalibrationCacheStats,
  IrtCalibrationQueue,
  IrtCalibrationRuns,
  IrtScalePublicationQueue,
  IrtScaleQualityChecks,
  IrtScaleQualityRefreshQueue,
  IrtScaleVersionItems,
  IrtScaleVersions,
} from "@repo/backend/confect/modules/tryout/irt.tables";
import {
  TryoutAttempts,
  TryoutCatalogMeta,
  TryoutLeaderboardEntries,
  TryoutPartAttempts,
  TryoutPartSets,
  Tryouts,
  UserTryoutStats,
} from "@repo/backend/confect/modules/tryout/tryouts.tables";
import { Effect, Schema } from "effect";

/** Tables whose row counts are audited by content-sync maintenance tools. */
const countableTables = [
  ArticleContents,
  SubjectTopics,
  SubjectSections,
  ExerciseSets,
  ExerciseQuestions,
  ExerciseAttempts,
  ExerciseAnswers,
  TryoutAccessCampaigns,
  TryoutAccessCampaignProducts,
  TryoutAccessLinks,
  TryoutAccessGrants,
  Tryouts,
  TryoutCatalogMeta,
  UserTryoutEntitlements,
  TryoutPartSets,
  TryoutAttempts,
  TryoutPartAttempts,
  TryoutLeaderboardEntries,
  UserTryoutStats,
  IrtCalibrationQueue,
  IrtCalibrationAttempts,
  IrtCalibrationCacheStats,
  IrtScaleQualityChecks,
  IrtScaleQualityRefreshQueue,
  IrtCalibrationRuns,
  ExerciseItemParameters,
  IrtScalePublicationQueue,
  IrtScaleVersions,
  IrtScaleVersionItems,
  ContentSearch,
  Authors,
  ContentAuthors,
  ArticleReferences,
  ExerciseChoices,
] as const;

export const countableTableNameSchema = Schema.Literal(
  ...countableTables.map((table) => table.name)
);

export type CountableTableName = typeof countableTableNameSchema.Type;

/** Content-owned tables that expose locale and slug for stale-row cleanup. */
const staleContentTables = [
  ArticleContents,
  SubjectTopics,
  SubjectSections,
  ExerciseSets,
  ExerciseQuestions,
] as const;

export const staleContentTableNameSchema = Schema.Literal(
  ...staleContentTables.map((table) => table.name)
);

export type StaleContentTableName = typeof staleContentTableNameSchema.Type;

/** Args accepted by the content-sync batch-size guard. */
export const contentSyncBatchSizeArgsSchema = Schema.Struct({
  functionName: Schema.String,
  limit: Schema.Number,
  received: Schema.Number,
  unit: Schema.String,
});

export type ContentSyncBatchSizeArgs =
  typeof contentSyncBatchSizeArgsSchema.Type;

export class ContentSyncError extends Schema.TaggedError<ContentSyncError>()(
  "ContentSyncError",
  { message: Schema.String }
) {}

/** Fails when a content sync batch exceeds its documented safety limit. */
export function assertContentSyncBatchSize(args: ContentSyncBatchSizeArgs) {
  if (args.received <= args.limit) {
    return Effect.succeed(null);
  }

  return Effect.fail(
    new ContentSyncError({
      message: `${args.functionName} received ${args.received} ${args.unit}, which exceeds the safe limit of ${args.limit}.`,
    })
  );
}

/** Converts display text into the same sync slug format used by content scripts. */
export function slugify(text: string) {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/[\s-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
