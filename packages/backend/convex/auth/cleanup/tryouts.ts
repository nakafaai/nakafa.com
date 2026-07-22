import type { Doc, Id } from "@repo/backend/convex/_generated/dataModel";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import {
  InvalidTryoutCleanupStateError,
  tryUserCleanup,
} from "@repo/backend/convex/auth/cleanup/spec";
import { Effect } from "effect";

const ATTEMPT_BATCH_SIZE = 10;
const PROGRESS_BATCH_SIZE = 25;
const LEADERBOARD_BATCH_SIZE = 25;
const STATS_BATCH_SIZE = 25;
const ENTITLEMENT_BATCH_SIZE = 25;
const ACCESS_GRANT_BATCH_SIZE = 25;

/** Deletes one try-out attempt and every runtime row that belongs to it. */
const deleteAttemptRuntime = Effect.fn("auth.cleanup.deleteAttemptRuntime")(
  function* (ctx: MutationCtx, attempt: Doc<"tryoutAttempts">) {
    const sections = yield* tryUserCleanup(() =>
      ctx.db
        .query("tryoutSectionAttempts")
        .withIndex("by_tryoutAttemptId_and_sectionOrder", (query) =>
          query.eq("tryoutAttemptId", attempt._id)
        )
        .take(attempt.sectionSnapshots.length + 1)
    );

    if (sections.length > attempt.sectionSnapshots.length) {
      return yield* new InvalidTryoutCleanupStateError({
        code: "INVALID_TRYOUT_STATE",
        message: "Tryout attempt has more sections than its snapshot.",
      });
    }

    for (const section of sections) {
      const responses = yield* tryUserCleanup(() =>
        ctx.db
          .query("tryoutResponses")
          .withIndex("by_tryoutSectionAttemptId_and_questionId", (query) =>
            query.eq("tryoutSectionAttemptId", section._id)
          )
          .take(section.totalQuestions + 1)
      );

      if (responses.length > section.totalQuestions) {
        return yield* new InvalidTryoutCleanupStateError({
          code: "INVALID_TRYOUT_STATE",
          message: "Tryout section has more responses than questions.",
        });
      }

      for (const response of responses) {
        yield* tryUserCleanup(() =>
          ctx.db.delete("tryoutResponses", response._id)
        );
      }

      yield* tryUserCleanup(() =>
        ctx.db.delete("tryoutSectionAttempts", section._id)
      );
    }

    const placements = yield* tryUserCleanup(() =>
      ctx.db
        .query("tryoutAttemptPlacements")
        .withIndex("by_tryoutAttemptId_and_questionOrder", (query) =>
          query.eq("tryoutAttemptId", attempt._id)
        )
        .take(attempt.totalQuestions + 1)
    );

    if (placements.length > attempt.totalQuestions) {
      return yield* new InvalidTryoutCleanupStateError({
        code: "INVALID_TRYOUT_STATE",
        message: "Tryout attempt has more placements than questions.",
      });
    }

    for (const placement of placements) {
      yield* tryUserCleanup(() =>
        ctx.db.delete("tryoutAttemptPlacements", placement._id)
      );
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
    }

    yield* tryUserCleanup(() => ctx.db.delete("tryoutAttempts", attempt._id));
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

    if (progress.length === PROGRESS_BATCH_SIZE) {
      return true;
    }

    const attempts = yield* tryUserCleanup(() =>
      ctx.db
        .query("tryoutAttempts")
        .withIndex("by_userId_and_startedAt", (query) =>
          query.eq("userId", userId)
        )
        .take(ATTEMPT_BATCH_SIZE)
    );

    for (const attempt of attempts) {
      yield* deleteAttemptRuntime(ctx, attempt);
    }

    if (attempts.length === ATTEMPT_BATCH_SIZE) {
      return true;
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

    if (leaderboard.length === LEADERBOARD_BATCH_SIZE) {
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

    if (stats.length === STATS_BATCH_SIZE) {
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

    if (entitlements.length === ENTITLEMENT_BATCH_SIZE) {
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

    if (accessGrants.length === ACCESS_GRANT_BATCH_SIZE) {
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
    }

    return false;
  }
);
