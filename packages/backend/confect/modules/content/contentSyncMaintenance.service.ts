import { MutationCtx } from "@repo/backend/confect/_generated/services";
import { Effect, Schema } from "effect";

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
  const ctx = yield* MutationCtx;
  const docs = yield* Effect.promise(() =>
    ctx.db.query(tableName).take(RESET_BATCH_SIZE)
  );
  let deleted = 0;

  for (const doc of docs) {
    yield* Effect.promise(() => ctx.db.delete(doc._id));
    deleted += 1;
  }

  const nextDoc = yield* Effect.promise(() => ctx.db.query(tableName).first());

  return { deleted, hasMore: nextDoc !== null };
});

/** Deletes tryout runtime attempts with their linked exercise attempts. */
export const deleteTryoutRuntimeBatch = Effect.fn(
  "contentSync.maintenance.deleteTryoutRuntimeBatch"
)(function* () {
  const ctx = yield* MutationCtx;
  const partAttempts = yield* Effect.promise(() =>
    ctx.db.query("tryoutPartAttempts").take(RESET_BATCH_SIZE)
  );
  let deleted = 0;

  for (const partAttempt of partAttempts) {
    const exerciseAttempt = yield* Effect.promise(() =>
      ctx.db.get(partAttempt.setAttemptId)
    );

    if (exerciseAttempt) {
      const answers = yield* Effect.promise(() =>
        ctx.db
          .query("exerciseAnswers")
          .withIndex("by_attemptId_and_exerciseNumber", (query) =>
            query.eq("attemptId", exerciseAttempt._id)
          )
          .take(exerciseAttempt.totalExercises + 1)
      );

      if (answers.length > exerciseAttempt.totalExercises) {
        return yield* Effect.fail(
          new ContentSyncMaintenanceError({
            message:
              "Tryout exercise answer count exceeds the exercise attempt total exercises.",
          })
        );
      }

      for (const answer of answers) {
        yield* Effect.promise(() => ctx.db.delete(answer._id));
      }

      yield* Effect.promise(() => ctx.db.delete(exerciseAttempt._id));
    }

    yield* Effect.promise(() => ctx.db.delete(partAttempt._id));
    deleted += 1;
  }

  const nextPartAttempt = yield* Effect.promise(() =>
    ctx.db.query("tryoutPartAttempts").first()
  );

  return { deleted, hasMore: nextPartAttempt !== null };
});

/** Deletes event tryout entitlements with their larger reset batch size. */
export const deleteTryoutEntitlementsBatch = Effect.fn(
  "contentSync.maintenance.deleteTryoutEntitlementsBatch"
)(function* () {
  const ctx = yield* MutationCtx;
  const entitlements = yield* Effect.promise(() =>
    ctx.db
      .query("userTryoutEntitlements")
      .take(EVENT_TRYOUT_ENTITLEMENT_BATCH_SIZE)
  );

  for (const entitlement of entitlements) {
    yield* Effect.promise(() => ctx.db.delete(entitlement._id));
  }

  const nextEntitlement = yield* Effect.promise(() =>
    ctx.db.query("userTryoutEntitlements").first()
  );

  return {
    deleted: entitlements.length,
    hasMore: nextEntitlement !== null,
  };
});
