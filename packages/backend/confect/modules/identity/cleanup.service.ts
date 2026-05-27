import { type GenericId, Ref } from "@confect/core";
import type { Doc } from "@repo/backend/confect/_generated/dataModel";
import refs from "@repo/backend/confect/_generated/refs";
import { MutationCtx } from "@repo/backend/confect/_generated/services";
import type { ConvexMutationCtx } from "@repo/backend/confect/modules/shared/convexContext";
import { Effect, Schema } from "effect";

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
const scheduleCleanupRetry = Effect.fn("identity.scheduleCleanupRetry")(
  function* (
    ctx: ConvexMutationCtx,
    args: { userId: GenericId.GenericId<"users"> }
  ) {
    yield* Effect.promise(() =>
      ctx.scheduler.runAfter(
        0,
        Ref.getFunctionReference(refs.internal.auth.cleanup.cleanupDeletedUser),
        args
      )
    );
  }
);

/** Deletes one tryout part attempt and its linked exercise attempt records. */
const deleteTryoutPartAttempt = Effect.fn("identity.deleteTryoutPartAttempt")(
  function* (ctx: ConvexMutationCtx, partAttempt: Doc<"tryoutPartAttempts">) {
    const setAttempt = yield* Effect.promise(() =>
      ctx.db.get(partAttempt.setAttemptId)
    );

    if (setAttempt) {
      const answers = yield* Effect.promise(() =>
        ctx.db
          .query("exerciseAnswers")
          .withIndex("by_attemptId_and_exerciseNumber", (query) =>
            query.eq("attemptId", setAttempt._id)
          )
          .take(setAttempt.totalExercises + 1)
      );

      if (answers.length > setAttempt.totalExercises) {
        return yield* Effect.fail(
          new CleanupInvariantError({
            message:
              "Tryout exercise answer count exceeds the exercise attempt total exercises.",
          })
        );
      }

      for (const answer of answers) {
        yield* Effect.promise(() => ctx.db.delete(answer._id));
      }

      yield* Effect.promise(() => ctx.db.delete(setAttempt._id));
    }

    yield* Effect.promise(() => ctx.db.delete(partAttempt._id));
  }
);

/** Deletes one tryout attempt and all of its part attempts. */
const deleteTryoutAttempt = Effect.fn("identity.deleteTryoutAttempt")(
  function* (ctx: ConvexMutationCtx, tryoutAttempt: Doc<"tryoutAttempts">) {
    const partAttempts = yield* Effect.promise(() =>
      ctx.db
        .query("tryoutPartAttempts")
        .withIndex("by_tryoutAttemptId_and_partIndex", (query) =>
          query.eq("tryoutAttemptId", tryoutAttempt._id)
        )
        .take(tryoutAttempt.partSetSnapshots.length + 1)
    );

    if (partAttempts.length > tryoutAttempt.partSetSnapshots.length) {
      return yield* Effect.fail(
        new CleanupInvariantError({
          message: "Tryout attempt has more part attempts than snapshot parts.",
        })
      );
    }

    for (const partAttempt of partAttempts) {
      yield* deleteTryoutPartAttempt(ctx, partAttempt);
    }

    yield* Effect.promise(() => ctx.db.delete(tryoutAttempt._id));
  }
);

/** Deletes a bounded batch of tryout attempts for a user. */
const deleteTryoutAttemptsBatch = Effect.fn(
  "identity.deleteTryoutAttemptsBatch"
)(function* (ctx: ConvexMutationCtx, userId: GenericId.GenericId<"users">) {
  const tryoutAttempts = yield* Effect.promise(() =>
    ctx.db
      .query("tryoutAttempts")
      .withIndex("by_userId_and_startedAt", (query) =>
        query.eq("userId", userId)
      )
      .take(TRYOUT_ATTEMPT_CLEANUP_BATCH_SIZE)
  );

  for (const tryoutAttempt of tryoutAttempts) {
    yield* deleteTryoutAttempt(ctx, tryoutAttempt);
  }

  return tryoutAttempts.length === TRYOUT_ATTEMPT_CLEANUP_BATCH_SIZE;
});

/** Deletes all user-owned records in bounded retryable batches. */
export const cleanupDeletedUser = Effect.fn("identity.cleanupDeletedUser")(
  function* (args: { userId: GenericId.GenericId<"users"> }) {
    const ctx = yield* MutationCtx;

    const notificationPreferences = yield* Effect.promise(() =>
      ctx.db
        .query("notificationPreferences")
        .withIndex("by_userId", (query) => query.eq("userId", args.userId))
        .take(NOTIFICATION_PREFERENCES_CLEANUP_BATCH_SIZE)
    );
    for (const preference of notificationPreferences) {
      yield* Effect.promise(() => ctx.db.delete(preference._id));
    }
    if (
      notificationPreferences.length ===
      NOTIFICATION_PREFERENCES_CLEANUP_BATCH_SIZE
    ) {
      yield* scheduleCleanupRetry(ctx, args);
      return null;
    }

    const notificationEntityMutes = yield* Effect.promise(() =>
      ctx.db
        .query("notificationEntityMutes")
        .withIndex("by_userId", (query) => query.eq("userId", args.userId))
        .take(NOTIFICATION_ENTITY_MUTES_CLEANUP_BATCH_SIZE)
    );
    for (const mutedEntity of notificationEntityMutes) {
      yield* Effect.promise(() => ctx.db.delete(mutedEntity._id));
    }
    if (
      notificationEntityMutes.length ===
      NOTIFICATION_ENTITY_MUTES_CLEANUP_BATCH_SIZE
    ) {
      yield* scheduleCleanupRetry(ctx, args);
      return null;
    }

    const notificationCounts = yield* Effect.promise(() =>
      ctx.db
        .query("notificationCounts")
        .withIndex("by_userId", (query) => query.eq("userId", args.userId))
        .take(NOTIFICATION_COUNT_CLEANUP_BATCH_SIZE)
    );
    for (const count of notificationCounts) {
      yield* Effect.promise(() => ctx.db.delete(count._id));
    }
    if (notificationCounts.length === NOTIFICATION_COUNT_CLEANUP_BATCH_SIZE) {
      yield* scheduleCleanupRetry(ctx, args);
      return null;
    }

    const notificationsByRecipient = yield* Effect.promise(() =>
      ctx.db
        .query("notifications")
        .withIndex("by_recipientId", (query) =>
          query.eq("recipientId", args.userId)
        )
        .take(NOTIFICATION_RECIPIENT_CLEANUP_BATCH_SIZE)
    );
    for (const notification of notificationsByRecipient) {
      yield* Effect.promise(() => ctx.db.delete(notification._id));
    }
    if (
      notificationsByRecipient.length ===
      NOTIFICATION_RECIPIENT_CLEANUP_BATCH_SIZE
    ) {
      yield* scheduleCleanupRetry(ctx, args);
      return null;
    }

    const notificationsByActor = yield* Effect.promise(() =>
      ctx.db
        .query("notifications")
        .withIndex("by_actorId", (query) => query.eq("actorId", args.userId))
        .take(NOTIFICATION_ACTOR_CLEANUP_BATCH_SIZE)
    );
    for (const notification of notificationsByActor) {
      yield* Effect.promise(() => ctx.db.delete(notification._id));
    }
    if (notificationsByActor.length === NOTIFICATION_ACTOR_CLEANUP_BATCH_SIZE) {
      yield* scheduleCleanupRetry(ctx, args);
      return null;
    }

    if (yield* deleteTryoutAttemptsBatch(ctx, args.userId)) {
      yield* scheduleCleanupRetry(ctx, args);
      return null;
    }

    const leaderboardEntries = yield* Effect.promise(() =>
      ctx.db
        .query("tryoutLeaderboardEntries")
        .withIndex(
          "by_userId_and_leaderboardNamespace_and_completedAt",
          (query) => query.eq("userId", args.userId)
        )
        .take(TRYOUT_LEADERBOARD_CLEANUP_BATCH_SIZE)
    );
    for (const leaderboardEntry of leaderboardEntries) {
      yield* Effect.promise(() => ctx.db.delete(leaderboardEntry._id));
    }
    if (leaderboardEntries.length === TRYOUT_LEADERBOARD_CLEANUP_BATCH_SIZE) {
      yield* scheduleCleanupRetry(ctx, args);
      return null;
    }

    const tryoutStats = yield* Effect.promise(() =>
      ctx.db
        .query("userTryoutStats")
        .withIndex("by_userId_and_product_and_leaderboardNamespace", (query) =>
          query.eq("userId", args.userId)
        )
        .take(TRYOUT_STATS_CLEANUP_BATCH_SIZE)
    );
    for (const tryoutStat of tryoutStats) {
      yield* Effect.promise(() => ctx.db.delete(tryoutStat._id));
    }
    if (tryoutStats.length === TRYOUT_STATS_CLEANUP_BATCH_SIZE) {
      yield* scheduleCleanupRetry(ctx, args);
      return null;
    }

    const entitlements = yield* Effect.promise(() =>
      ctx.db
        .query("userTryoutEntitlements")
        .withIndex("by_userId_and_product_and_sourceKind_and_endsAt", (query) =>
          query.eq("userId", args.userId)
        )
        .take(TRYOUT_ENTITLEMENT_CLEANUP_BATCH_SIZE)
    );
    for (const entitlement of entitlements) {
      yield* Effect.promise(() => ctx.db.delete(entitlement._id));
    }
    if (entitlements.length === TRYOUT_ENTITLEMENT_CLEANUP_BATCH_SIZE) {
      yield* scheduleCleanupRetry(ctx, args);
      return null;
    }

    const accessGrants = yield* Effect.promise(() =>
      ctx.db
        .query("tryoutAccessGrants")
        .withIndex("by_userId_and_campaignId", (query) =>
          query.eq("userId", args.userId)
        )
        .take(TRYOUT_ACCESS_GRANT_CLEANUP_BATCH_SIZE)
    );
    for (const accessGrant of accessGrants) {
      yield* Effect.promise(() => ctx.db.delete(accessGrant._id));
    }
    if (accessGrants.length === TRYOUT_ACCESS_GRANT_CLEANUP_BATCH_SIZE) {
      yield* scheduleCleanupRetry(ctx, args);
      return null;
    }

    const user = yield* Effect.promise(() => ctx.db.get(args.userId));
    if (user) {
      yield* Effect.promise(() => ctx.db.delete(args.userId));
    }

    return null;
  }
);
