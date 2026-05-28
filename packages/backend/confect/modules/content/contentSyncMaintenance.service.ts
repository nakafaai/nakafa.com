import {
  DatabaseReader,
  DatabaseWriter,
} from "@repo/backend/confect/_generated/services";
import { Effect, Option, Schema } from "effect";

const RESET_BATCH_SIZE = 500;
const EVENT_TRYOUT_ENTITLEMENT_BATCH_SIZE = 500;

export class ContentSyncMaintenanceError extends Schema.TaggedError<ContentSyncMaintenanceError>()(
  "ContentSyncMaintenanceError",
  { message: Schema.String }
) {}

export type ResettableTableName =
  | "articleReferences"
  | "articleContents"
  | "authors"
  | "contentAuthors"
  | "contentSearch"
  | "exerciseAnswers"
  | "exerciseAttempts"
  | "exerciseChoices"
  | "exerciseItemParameters"
  | "exerciseQuestions"
  | "exerciseSets"
  | "irtCalibrationAttempts"
  | "irtCalibrationCacheStats"
  | "irtCalibrationQueue"
  | "irtCalibrationRuns"
  | "irtScalePublicationQueue"
  | "irtScaleQualityChecks"
  | "irtScaleQualityRefreshQueue"
  | "irtScaleVersionItems"
  | "irtScaleVersions"
  | "subjectSections"
  | "subjectTopics"
  | "tryoutAccessCampaignProducts"
  | "tryoutAccessCampaigns"
  | "tryoutAccessGrants"
  | "tryoutAccessLinks"
  | "tryoutAttempts"
  | "tryoutCatalogMeta"
  | "tryoutLeaderboardEntries"
  | "tryoutPartAttempts"
  | "tryoutPartSets"
  | "tryouts"
  | "userTryoutStats";

/** Deletes one bounded batch from a resettable sync table. */
export const deleteBatchFromTable = Effect.fn(
  "contentSync.maintenance.deleteBatchFromTable"
)(function* (tableName: ResettableTableName) {
  const reader = yield* DatabaseReader;
  const writer = yield* DatabaseWriter;
  const docs = yield* reader
    .table(tableName)
    .index("by_creation_time")
    .take(RESET_BATCH_SIZE);
  let deleted = 0;

  for (const doc of docs) {
    yield* writer.table(tableName).delete(doc._id);
    deleted += 1;
  }

  const nextDoc = yield* reader
    .table(tableName)
    .index("by_creation_time")
    .first();

  return { deleted, hasMore: Option.isSome(nextDoc) };
});

/** Deletes tryout runtime attempts with their linked exercise attempts. */
export const deleteTryoutRuntimeBatch = Effect.fn(
  "contentSync.maintenance.deleteTryoutRuntimeBatch"
)(function* () {
  const reader = yield* DatabaseReader;
  const writer = yield* DatabaseWriter;
  const partAttempts = yield* reader
    .table("tryoutPartAttempts")
    .index("by_creation_time")
    .take(RESET_BATCH_SIZE);
  let deleted = 0;

  for (const partAttempt of partAttempts) {
    const exerciseAttempt = yield* reader
      .table("exerciseAttempts")
      .get(partAttempt.setAttemptId)
      .pipe(Effect.catchTag("GetByIdFailure", () => Effect.succeed(null)));

    if (exerciseAttempt) {
      const answers = yield* reader
        .table("exerciseAnswers")
        .index("by_attemptId_and_exerciseNumber", (query) =>
          query.eq("attemptId", exerciseAttempt._id)
        )
        .take(exerciseAttempt.totalExercises + 1);

      if (answers.length > exerciseAttempt.totalExercises) {
        return yield* Effect.fail(
          new ContentSyncMaintenanceError({
            message:
              "Tryout exercise answer count exceeds the exercise attempt total exercises.",
          })
        );
      }

      for (const answer of answers) {
        yield* writer.table("exerciseAnswers").delete(answer._id);
      }

      yield* writer.table("exerciseAttempts").delete(exerciseAttempt._id);
    }

    yield* writer.table("tryoutPartAttempts").delete(partAttempt._id);
    deleted += 1;
  }

  const nextPartAttempt = yield* reader
    .table("tryoutPartAttempts")
    .index("by_creation_time")
    .first();

  return { deleted, hasMore: Option.isSome(nextPartAttempt) };
});

/** Deletes event tryout entitlements with their larger reset batch size. */
export const deleteTryoutEntitlementsBatch = Effect.fn(
  "contentSync.maintenance.deleteTryoutEntitlementsBatch"
)(function* () {
  const reader = yield* DatabaseReader;
  const writer = yield* DatabaseWriter;
  const entitlements = yield* reader
    .table("userTryoutEntitlements")
    .index("by_creation_time")
    .take(EVENT_TRYOUT_ENTITLEMENT_BATCH_SIZE);

  for (const entitlement of entitlements) {
    yield* writer.table("userTryoutEntitlements").delete(entitlement._id);
  }

  const nextEntitlement = yield* reader
    .table("userTryoutEntitlements")
    .index("by_creation_time")
    .first();

  return {
    deleted: entitlements.length,
    hasMore: Option.isSome(nextEntitlement),
  };
});
