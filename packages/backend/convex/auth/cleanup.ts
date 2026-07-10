import { internal } from "@repo/backend/convex/_generated/api";
import type { Doc, Id } from "@repo/backend/convex/_generated/dataModel";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import { internalMutation } from "@repo/backend/convex/functions";
import { ConvexError, v } from "convex/values";

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

/** Re-schedules user cleanup so each invocation stays within transaction limits. */
async function scheduleCleanupRetry(
  ctx: Pick<MutationCtx, "scheduler">,
  args: { userId: Id<"users"> }
) {
  await ctx.scheduler.runAfter(
    0,
    internal.auth.cleanup.cleanupDeletedUser,
    args
  );
}

/** Deletes one tryout attempt together with every linked part runtime row. */
async function deleteTryoutAttemptRuntime(
  ctx: Pick<MutationCtx, "db">,
  tryoutAttempt: Doc<"tryoutAttempts">
) {
  const sectionAttempts = await ctx.db
    .query("tryoutSectionAttempts")
    .withIndex("by_tryoutAttemptId_and_sectionOrder", (q) =>
      q.eq("tryoutAttemptId", tryoutAttempt._id)
    )
    .take(tryoutAttempt.sectionSnapshots.length + 1);

  if (sectionAttempts.length > tryoutAttempt.sectionSnapshots.length) {
    throw new ConvexError({
      code: "INVALID_TRYOUT_STATE",
      message: "Tryout attempt has more section attempts than snapshots.",
    });
  }

  for (const sectionAttempt of sectionAttempts) {
    const responses = await ctx.db
      .query("tryoutResponses")
      .withIndex("by_tryoutSectionAttemptId_and_questionId", (q) =>
        q.eq("tryoutSectionAttemptId", sectionAttempt._id)
      )
      .take(sectionAttempt.totalQuestions + 1);

    if (responses.length > sectionAttempt.totalQuestions) {
      throw new ConvexError({
        code: "INVALID_TRYOUT_STATE",
        message: "Tryout section attempt has more responses than questions.",
      });
    }

    for (const response of responses) {
      await ctx.db.delete("tryoutResponses", response._id);
    }

    await ctx.db.delete("tryoutSectionAttempts", sectionAttempt._id);
  }

  const placements = await ctx.db
    .query("tryoutAttemptPlacements")
    .withIndex("by_tryoutAttemptId_and_questionOrder", (q) =>
      q.eq("tryoutAttemptId", tryoutAttempt._id)
    )
    .take(tryoutAttempt.totalQuestions + 1);

  if (placements.length > tryoutAttempt.totalQuestions) {
    throw new ConvexError({
      code: "INVALID_TRYOUT_STATE",
      message: "Tryout attempt has more placements than questions.",
    });
  }

  for (const placement of placements) {
    await ctx.db.delete("tryoutAttemptPlacements", placement._id);
  }

  const score = await ctx.db
    .query("tryoutScores")
    .withIndex("by_tryoutAttemptId", (q) =>
      q.eq("tryoutAttemptId", tryoutAttempt._id)
    )
    .unique();

  if (score) {
    await ctx.db.delete("tryoutScores", score._id);
  }

  await ctx.db.delete("tryoutAttempts", tryoutAttempt._id);
}

/** Deletes one bounded batch of tryout attempts for a deleted user. */
async function deleteTryoutAttemptsBatch(
  ctx: Pick<MutationCtx, "db">,
  userId: Id<"users">
) {
  const tryoutAttempts = await ctx.db
    .query("tryoutAttempts")
    .withIndex("by_userId_and_startedAt", (q) => q.eq("userId", userId))
    .take(TRYOUT_ATTEMPT_CLEANUP_BATCH_SIZE);

  for (const tryoutAttempt of tryoutAttempts) {
    await deleteTryoutAttemptRuntime(ctx, tryoutAttempt);
  }

  return tryoutAttempts.length === TRYOUT_ATTEMPT_CLEANUP_BATCH_SIZE;
}

/** Deletes one bounded batch of leaderboard rows for a deleted user. */
async function deleteTryoutLeaderboardEntriesBatch(
  ctx: Pick<MutationCtx, "db">,
  userId: Id<"users">
) {
  const leaderboardEntries = await ctx.db
    .query("tryoutLeaderboardEntries")
    .withIndex("by_userId_and_leaderboardScopeId_and_completedAt", (q) =>
      q.eq("userId", userId)
    )
    .take(TRYOUT_LEADERBOARD_CLEANUP_BATCH_SIZE);

  for (const leaderboardEntry of leaderboardEntries) {
    await ctx.db.delete("tryoutLeaderboardEntries", leaderboardEntry._id);
  }

  return leaderboardEntries.length === TRYOUT_LEADERBOARD_CLEANUP_BATCH_SIZE;
}

/** Deletes one bounded batch of personal try-out leaderboard stats for a deleted user. */
async function deleteTryoutLeaderboardUserStatsBatch(
  ctx: Pick<MutationCtx, "db">,
  userId: Id<"users">
) {
  const tryoutStats = await ctx.db
    .query("tryoutLeaderboardUserStats")
    .withIndex("by_userId_and_leaderboardScopeId", (q) =>
      q.eq("userId", userId)
    )
    .take(TRYOUT_STATS_CLEANUP_BATCH_SIZE);

  for (const tryoutStat of tryoutStats) {
    await ctx.db.delete("tryoutLeaderboardUserStats", tryoutStat._id);
  }

  return tryoutStats.length === TRYOUT_STATS_CLEANUP_BATCH_SIZE;
}

/** Deletes one bounded batch of active tryout entitlements for a deleted user. */
async function deleteUserTryoutEntitlementsBatch(
  ctx: Pick<MutationCtx, "db">,
  userId: Id<"users">
) {
  const entitlements = await ctx.db
    .query("tryoutEntitlements")
    .withIndex("by_user_tryout_scope_endsAt", (q) => q.eq("userId", userId))
    .take(TRYOUT_ENTITLEMENT_CLEANUP_BATCH_SIZE);

  for (const entitlement of entitlements) {
    await ctx.db.delete("tryoutEntitlements", entitlement._id);
  }

  return entitlements.length === TRYOUT_ENTITLEMENT_CLEANUP_BATCH_SIZE;
}

/** Deletes one bounded batch of redeemed access grants for a deleted user. */
async function deleteUserTryoutAccessGrantsBatch(
  ctx: Pick<MutationCtx, "db">,
  userId: Id<"users">
) {
  const accessGrants = await ctx.db
    .query("tryoutAccessGrants")
    .withIndex("by_userId_and_campaignId", (q) => q.eq("userId", userId))
    .take(TRYOUT_ACCESS_GRANT_CLEANUP_BATCH_SIZE);

  for (const accessGrant of accessGrants) {
    await ctx.db.delete("tryoutAccessGrants", accessGrant._id);
  }

  return accessGrants.length === TRYOUT_ACCESS_GRANT_CLEANUP_BATCH_SIZE;
}

/** Deletes one user's local auth-related rows in bounded batches. */
export const cleanupDeletedUser = internalMutation({
  args: {
    userId: v.id("users"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const notificationPreferences = await ctx.db
      .query("notificationPreferences")
      .withIndex("by_userId", (q) => q.eq("userId", args.userId))
      .take(NOTIFICATION_PREFERENCES_CLEANUP_BATCH_SIZE);

    for (const preference of notificationPreferences) {
      await ctx.db.delete("notificationPreferences", preference._id);
    }

    if (
      notificationPreferences.length ===
      NOTIFICATION_PREFERENCES_CLEANUP_BATCH_SIZE
    ) {
      await scheduleCleanupRetry(ctx, args);
      return null;
    }

    const notificationEntityMutes = await ctx.db
      .query("notificationEntityMutes")
      .withIndex("by_userId", (q) => q.eq("userId", args.userId))
      .take(NOTIFICATION_ENTITY_MUTES_CLEANUP_BATCH_SIZE);

    for (const mutedEntity of notificationEntityMutes) {
      await ctx.db.delete("notificationEntityMutes", mutedEntity._id);
    }

    if (
      notificationEntityMutes.length ===
      NOTIFICATION_ENTITY_MUTES_CLEANUP_BATCH_SIZE
    ) {
      await scheduleCleanupRetry(ctx, args);
      return null;
    }

    const notificationCounts = await ctx.db
      .query("notificationCounts")
      .withIndex("by_userId", (q) => q.eq("userId", args.userId))
      .take(NOTIFICATION_COUNT_CLEANUP_BATCH_SIZE);

    for (const count of notificationCounts) {
      await ctx.db.delete("notificationCounts", count._id);
    }

    if (notificationCounts.length === NOTIFICATION_COUNT_CLEANUP_BATCH_SIZE) {
      await scheduleCleanupRetry(ctx, args);
      return null;
    }

    const notificationsByRecipient = await ctx.db
      .query("notifications")
      .withIndex("by_recipientId", (q) => q.eq("recipientId", args.userId))
      .take(NOTIFICATION_RECIPIENT_CLEANUP_BATCH_SIZE);

    for (const notification of notificationsByRecipient) {
      await ctx.db.delete("notifications", notification._id);
    }

    if (
      notificationsByRecipient.length ===
      NOTIFICATION_RECIPIENT_CLEANUP_BATCH_SIZE
    ) {
      await scheduleCleanupRetry(ctx, args);
      return null;
    }

    const notificationsByActor = await ctx.db
      .query("notifications")
      .withIndex("by_actorId", (q) => q.eq("actorId", args.userId))
      .take(NOTIFICATION_ACTOR_CLEANUP_BATCH_SIZE);

    for (const notification of notificationsByActor) {
      await ctx.db.delete("notifications", notification._id);
    }

    if (notificationsByActor.length === NOTIFICATION_ACTOR_CLEANUP_BATCH_SIZE) {
      await scheduleCleanupRetry(ctx, args);
      return null;
    }

    if (await deleteTryoutAttemptsBatch(ctx, args.userId)) {
      await scheduleCleanupRetry(ctx, args);
      return null;
    }

    if (await deleteTryoutLeaderboardEntriesBatch(ctx, args.userId)) {
      await scheduleCleanupRetry(ctx, args);
      return null;
    }

    if (await deleteTryoutLeaderboardUserStatsBatch(ctx, args.userId)) {
      await scheduleCleanupRetry(ctx, args);
      return null;
    }

    if (await deleteUserTryoutEntitlementsBatch(ctx, args.userId)) {
      await scheduleCleanupRetry(ctx, args);
      return null;
    }

    if (await deleteUserTryoutAccessGrantsBatch(ctx, args.userId)) {
      await scheduleCleanupRetry(ctx, args);
      return null;
    }

    const user = await ctx.db.get("users", args.userId);

    if (user) {
      await ctx.db.delete("users", args.userId);
    }

    return null;
  },
});
