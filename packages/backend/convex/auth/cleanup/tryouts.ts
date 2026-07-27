import type { Doc, Id } from "@repo/backend/convex/_generated/dataModel";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import { tryUserCleanup } from "@repo/backend/convex/auth/cleanup/spec";
import { Effect } from "effect";

const ATTEMPT_CHILD_BATCH_SIZE = 50;
const PROGRESS_BATCH_SIZE = 25;
const LEADERBOARD_BATCH_SIZE = 25;
const STATS_BATCH_SIZE = 25;
const ENTITLEMENT_BATCH_SIZE = 25;
const ACCESS_GRANT_BATCH_SIZE = 25;

/** Deletes one bounded phase from a try-out attempt runtime. */
const cleanupAttemptRuntime = Effect.fn("auth.cleanup.cleanupAttemptRuntime")(
  function* (ctx: MutationCtx, attempt: Doc<"tryoutAttempts">) {
    const section = yield* tryUserCleanup(() =>
      ctx.db
        .query("tryoutSectionAttempts")
        .withIndex("by_tryoutAttemptId_and_sectionOrder", (query) =>
          query.eq("tryoutAttemptId", attempt._id)
        )
        .first()
    );

    if (section) {
      const responses = yield* tryUserCleanup(() =>
        ctx.db
          .query("tryoutResponses")
          .withIndex("by_tryoutSectionAttemptId_and_questionId", (query) =>
            query.eq("tryoutSectionAttemptId", section._id)
          )
          .take(ATTEMPT_CHILD_BATCH_SIZE)
      );

      for (const response of responses) {
        yield* tryUserCleanup(() =>
          ctx.db.delete("tryoutResponses", response._id)
        );
      }

      if (responses.length > 0) {
        return true;
      }

      yield* tryUserCleanup(() =>
        ctx.db.delete("tryoutSectionAttempts", section._id)
      );
      return true;
    }

    const placements = yield* tryUserCleanup(() =>
      ctx.db
        .query("tryoutAttemptPlacements")
        .withIndex("by_tryoutAttemptId_and_questionOrder", (query) =>
          query.eq("tryoutAttemptId", attempt._id)
        )
        .take(ATTEMPT_CHILD_BATCH_SIZE)
    );

    for (const placement of placements) {
      yield* tryUserCleanup(() =>
        ctx.db.delete("tryoutAttemptPlacements", placement._id)
      );
    }

    if (placements.length > 0) {
      return true;
    }

    const score = yield* tryUserCleanup(() =>
      ctx.db
        .query("tryoutScores")
        .withIndex("by_tryoutAttemptId", (query) =>
          query.eq("tryoutAttemptId", attempt._id)
        )
        .unique()
    );

    if (score) {
      yield* tryUserCleanup(() => ctx.db.delete("tryoutScores", score._id));
      return true;
    }

    yield* tryUserCleanup(() => ctx.db.delete("tryoutAttempts", attempt._id));
    return true;
  }
);

/** Deletes one bounded batch of try-out runtime and access rows for a user. */
export const cleanupUserTryouts = Effect.fn("auth.cleanup.cleanupUserTryouts")(
  function* (ctx: MutationCtx, userId: Id<"users">) {
    const progress = yield* tryUserCleanup(() =>
      ctx.db
        .query("tryoutSetProgress")
        .withIndex("by_userId_and_track_and_statusRank_and_setKey", (query) =>
          query.eq("userId", userId)
        )
        .take(PROGRESS_BATCH_SIZE)
    );

    for (const row of progress) {
      yield* tryUserCleanup(() => ctx.db.delete("tryoutSetProgress", row._id));
    }

    if (progress.length > 0) {
      return true;
    }

    const attempt = yield* tryUserCleanup(() =>
      ctx.db
        .query("tryoutAttempts")
        .withIndex("by_userId_and_startedAt", (query) =>
          query.eq("userId", userId)
        )
        .first()
    );

    if (attempt) {
      return yield* cleanupAttemptRuntime(ctx, attempt);
    }

    const leaderboard = yield* tryUserCleanup(() =>
      ctx.db
        .query("tryoutLeaderboardEntries")
        .withIndex(
          "by_userId_and_leaderboardScopeId_and_completedAt",
          (query) => query.eq("userId", userId)
        )
        .take(LEADERBOARD_BATCH_SIZE)
    );

    for (const row of leaderboard) {
      yield* tryUserCleanup(() =>
        ctx.db.delete("tryoutLeaderboardEntries", row._id)
      );
    }

    if (leaderboard.length > 0) {
      return true;
    }

    const stats = yield* tryUserCleanup(() =>
      ctx.db
        .query("tryoutLeaderboardUserStats")
        .withIndex("by_userId_and_leaderboardScopeId", (query) =>
          query.eq("userId", userId)
        )
        .take(STATS_BATCH_SIZE)
    );

    for (const row of stats) {
      yield* tryUserCleanup(() =>
        ctx.db.delete("tryoutLeaderboardUserStats", row._id)
      );
    }

    if (stats.length > 0) {
      return true;
    }

    const entitlements = yield* tryUserCleanup(() =>
      ctx.db
        .query("tryoutEntitlements")
        .withIndex("by_user_tryout_scope_endsAt", (query) =>
          query.eq("userId", userId)
        )
        .take(ENTITLEMENT_BATCH_SIZE)
    );

    for (const entitlement of entitlements) {
      yield* tryUserCleanup(() =>
        ctx.db.delete("tryoutEntitlements", entitlement._id)
      );
    }

    if (entitlements.length > 0) {
      return true;
    }

    const accessGrants = yield* tryUserCleanup(() =>
      ctx.db
        .query("tryoutAccessGrants")
        .withIndex("by_userId_and_campaignId", (query) =>
          query.eq("userId", userId)
        )
        .take(ACCESS_GRANT_BATCH_SIZE)
    );

    for (const accessGrant of accessGrants) {
      yield* tryUserCleanup(() =>
        ctx.db.delete("tryoutAccessGrants", accessGrant._id)
      );
    }

    if (accessGrants.length > 0) {
      return true;
    }

    const freeClaim = yield* tryUserCleanup(() =>
      ctx.db
        .query("tryoutFreeAttemptClaims")
        .withIndex("by_userId", (query) => query.eq("userId", userId))
        .unique()
    );

    if (freeClaim) {
      yield* tryUserCleanup(() =>
        ctx.db.delete("tryoutFreeAttemptClaims", freeClaim._id)
      );
      return true;
    }

    return false;
  }
);
