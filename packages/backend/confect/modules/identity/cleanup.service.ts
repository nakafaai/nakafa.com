import type { GenericId } from "@confect/core";
import refs from "@repo/backend/confect/_generated/refs";
import {
  DatabaseReader,
  DatabaseWriter,
  Scheduler,
} from "@repo/backend/confect/_generated/services";
import type {
  TryoutAttempts,
  TryoutPartAttempts,
} from "@repo/backend/confect/modules/tryout/tryouts.tables";
import { Duration, Effect, Schema } from "effect";

const NOTIFICATION_PREFERENCES_CLEANUP_BATCH_SIZE = 10;
const NOTIFICATION_ENTITY_MUTES_CLEANUP_BATCH_SIZE = 25;
const NOTIFICATION_COUNT_CLEANUP_BATCH_SIZE = 10;
const NOTIFICATION_RECIPIENT_CLEANUP_BATCH_SIZE = 25;
const NOTIFICATION_ACTOR_CLEANUP_BATCH_SIZE = 25;
const TRYOUT_ATTEMPT_CLEANUP_BATCH_SIZE = 10;
const TRYOUT_LEADERBOARD_CLEANUP_BATCH_SIZE = 25;
const TRYOUT_STATS_CLEANUP_BATCH_SIZE = 25;
const TRYOUT_ENTITLEMENT_CLEANUP_BATCH_SIZE = 25;
const TRYOUT_ACCESS_GRANT_CLEANUP_BATCH_SIZE = 25;

export class CleanupInvariantError extends Schema.TaggedError<CleanupInvariantError>()(
  "CleanupInvariantError",
  { message: Schema.String }
) {}

/** Schedules the next cleanup batch when the current mutation reaches a cap. */
const scheduleCleanupRetry = Effect.fnUntraced(function* (args: {
  userId: GenericId.GenericId<"users">;
}) {
  const scheduler = yield* Scheduler;

  yield* scheduler.runAfter(
    Duration.millis(0),
    refs.internal.auth.cleanup.cleanupDeletedUser,
    args
  );
});

/** Deletes one tryout part attempt and its linked exercise attempt records. */
const deleteTryoutPartAttempt = Effect.fnUntraced(function* (
  partAttempt: typeof TryoutPartAttempts.Doc.Type
) {
  const reader = yield* DatabaseReader;
  const writer = yield* DatabaseWriter;
  const setAttempt = yield* reader
    .table("exerciseAttempts")
    .get(partAttempt.setAttemptId)
    .pipe(Effect.catchTag("GetByIdFailure", () => Effect.succeed(null)));

  if (setAttempt) {
    const answers = yield* reader
      .table("exerciseAnswers")
      .index("by_attemptId_and_exerciseNumber", (query) =>
        query.eq("attemptId", setAttempt._id)
      )
      .take(setAttempt.totalExercises + 1);

    if (answers.length > setAttempt.totalExercises) {
      return yield* Effect.fail(
        new CleanupInvariantError({
          message:
            "Tryout exercise answer count exceeds the exercise attempt total exercises.",
        })
      );
    }

    for (const answer of answers) {
      yield* writer.table("exerciseAnswers").delete(answer._id);
    }

    yield* writer.table("exerciseAttempts").delete(setAttempt._id);
  }

  yield* writer.table("tryoutPartAttempts").delete(partAttempt._id);
});

/** Deletes one tryout attempt and all of its part attempts. */
const deleteTryoutAttempt = Effect.fnUntraced(function* (
  tryoutAttempt: typeof TryoutAttempts.Doc.Type
) {
  const reader = yield* DatabaseReader;
  const writer = yield* DatabaseWriter;
  const partAttempts = yield* reader
    .table("tryoutPartAttempts")
    .index("by_tryoutAttemptId_and_partIndex", (query) =>
      query.eq("tryoutAttemptId", tryoutAttempt._id)
    )
    .take(tryoutAttempt.partSetSnapshots.length + 1);

  if (partAttempts.length > tryoutAttempt.partSetSnapshots.length) {
    return yield* Effect.fail(
      new CleanupInvariantError({
        message: "Tryout attempt has more part attempts than snapshot parts.",
      })
    );
  }

  for (const partAttempt of partAttempts) {
    yield* deleteTryoutPartAttempt(partAttempt);
  }

  yield* writer.table("tryoutAttempts").delete(tryoutAttempt._id);
});

/** Deletes a bounded batch of tryout attempts for a user. */
const deleteTryoutAttemptsBatch = Effect.fnUntraced(function* (
  userId: GenericId.GenericId<"users">
) {
  const reader = yield* DatabaseReader;
  const tryoutAttempts = yield* reader
    .table("tryoutAttempts")
    .index("by_userId_and_startedAt", (query) => query.eq("userId", userId))
    .take(TRYOUT_ATTEMPT_CLEANUP_BATCH_SIZE);

  for (const tryoutAttempt of tryoutAttempts) {
    yield* deleteTryoutAttempt(tryoutAttempt);
  }

  return tryoutAttempts.length === TRYOUT_ATTEMPT_CLEANUP_BATCH_SIZE;
});

/** Deletes all user-owned records in bounded retryable batches. */
export const cleanupDeletedUser = Effect.fnUntraced(function* (args: {
  userId: GenericId.GenericId<"users">;
}) {
  const reader = yield* DatabaseReader;
  const writer = yield* DatabaseWriter;

  const notificationPreferences = yield* reader
    .table("notificationPreferences")
    .index("by_userId", (query) => query.eq("userId", args.userId))
    .take(NOTIFICATION_PREFERENCES_CLEANUP_BATCH_SIZE);
  for (const preference of notificationPreferences) {
    yield* writer.table("notificationPreferences").delete(preference._id);
  }
  if (
    notificationPreferences.length ===
    NOTIFICATION_PREFERENCES_CLEANUP_BATCH_SIZE
  ) {
    yield* scheduleCleanupRetry(args);
    return null;
  }

  const notificationEntityMutes = yield* reader
    .table("notificationEntityMutes")
    .index("by_userId", (query) => query.eq("userId", args.userId))
    .take(NOTIFICATION_ENTITY_MUTES_CLEANUP_BATCH_SIZE);
  for (const mutedEntity of notificationEntityMutes) {
    yield* writer.table("notificationEntityMutes").delete(mutedEntity._id);
  }
  if (
    notificationEntityMutes.length ===
    NOTIFICATION_ENTITY_MUTES_CLEANUP_BATCH_SIZE
  ) {
    yield* scheduleCleanupRetry(args);
    return null;
  }

  const notificationCounts = yield* reader
    .table("notificationCounts")
    .index("by_userId", (query) => query.eq("userId", args.userId))
    .take(NOTIFICATION_COUNT_CLEANUP_BATCH_SIZE);
  for (const count of notificationCounts) {
    yield* writer.table("notificationCounts").delete(count._id);
  }
  if (notificationCounts.length === NOTIFICATION_COUNT_CLEANUP_BATCH_SIZE) {
    yield* scheduleCleanupRetry(args);
    return null;
  }

  const notificationsByRecipient = yield* reader
    .table("notifications")
    .index("by_recipientId", (query) => query.eq("recipientId", args.userId))
    .take(NOTIFICATION_RECIPIENT_CLEANUP_BATCH_SIZE);
  for (const notification of notificationsByRecipient) {
    yield* writer.table("notifications").delete(notification._id);
  }
  if (
    notificationsByRecipient.length ===
    NOTIFICATION_RECIPIENT_CLEANUP_BATCH_SIZE
  ) {
    yield* scheduleCleanupRetry(args);
    return null;
  }

  const notificationsByActor = yield* reader
    .table("notifications")
    .index("by_actorId", (query) => query.eq("actorId", args.userId))
    .take(NOTIFICATION_ACTOR_CLEANUP_BATCH_SIZE);
  for (const notification of notificationsByActor) {
    yield* writer.table("notifications").delete(notification._id);
  }
  if (notificationsByActor.length === NOTIFICATION_ACTOR_CLEANUP_BATCH_SIZE) {
    yield* scheduleCleanupRetry(args);
    return null;
  }

  if (yield* deleteTryoutAttemptsBatch(args.userId)) {
    yield* scheduleCleanupRetry(args);
    return null;
  }

  const leaderboardEntries = yield* reader
    .table("tryoutLeaderboardEntries")
    .index("by_userId_and_leaderboardNamespace_and_completedAt", (query) =>
      query.eq("userId", args.userId)
    )
    .take(TRYOUT_LEADERBOARD_CLEANUP_BATCH_SIZE);
  for (const leaderboardEntry of leaderboardEntries) {
    yield* writer
      .table("tryoutLeaderboardEntries")
      .delete(leaderboardEntry._id);
  }
  if (leaderboardEntries.length === TRYOUT_LEADERBOARD_CLEANUP_BATCH_SIZE) {
    yield* scheduleCleanupRetry(args);
    return null;
  }

  const tryoutStats = yield* reader
    .table("userTryoutStats")
    .index("by_userId_and_product_and_leaderboardNamespace", (query) =>
      query.eq("userId", args.userId)
    )
    .take(TRYOUT_STATS_CLEANUP_BATCH_SIZE);
  for (const tryoutStat of tryoutStats) {
    yield* writer.table("userTryoutStats").delete(tryoutStat._id);
  }
  if (tryoutStats.length === TRYOUT_STATS_CLEANUP_BATCH_SIZE) {
    yield* scheduleCleanupRetry(args);
    return null;
  }

  const entitlements = yield* reader
    .table("userTryoutEntitlements")
    .index("by_userId_and_product_and_sourceKind_and_endsAt", (query) =>
      query.eq("userId", args.userId)
    )
    .take(TRYOUT_ENTITLEMENT_CLEANUP_BATCH_SIZE);
  for (const entitlement of entitlements) {
    yield* writer.table("userTryoutEntitlements").delete(entitlement._id);
  }
  if (entitlements.length === TRYOUT_ENTITLEMENT_CLEANUP_BATCH_SIZE) {
    yield* scheduleCleanupRetry(args);
    return null;
  }

  const accessGrants = yield* reader
    .table("tryoutAccessGrants")
    .index("by_userId_and_campaignId", (query) =>
      query.eq("userId", args.userId)
    )
    .take(TRYOUT_ACCESS_GRANT_CLEANUP_BATCH_SIZE);
  for (const accessGrant of accessGrants) {
    yield* writer.table("tryoutAccessGrants").delete(accessGrant._id);
  }
  if (accessGrants.length === TRYOUT_ACCESS_GRANT_CLEANUP_BATCH_SIZE) {
    yield* scheduleCleanupRetry(args);
    return null;
  }

  const user = yield* reader
    .table("users")
    .get(args.userId)
    .pipe(Effect.catchTag("GetByIdFailure", () => Effect.succeed(null)));
  if (user) {
    yield* writer.table("users").delete(args.userId);
  }

  return null;
});
