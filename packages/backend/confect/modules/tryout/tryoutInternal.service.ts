import type { Id } from "@repo/backend/confect/_generated/dataModel";
import refs from "@repo/backend/confect/_generated/refs";
import {
  DatabaseReader,
  MutationCtx,
  Scheduler,
} from "@repo/backend/confect/_generated/services";
import { toConvexReference } from "@repo/backend/confect/modules/shared/convexReferences";
import {
  expireTryoutAttempt,
  syncTryoutAttemptExpiry,
} from "@repo/backend/confect/modules/tryout/tryoutExpiry.service";
import { syncTryoutAttemptAggregates } from "@repo/backend/confect/modules/tryout/tryoutFinalizeAggregates.service";
import { tryoutLeaderboardWorkpool } from "@repo/backend/confect/modules/tryout/tryoutWorkpool";
import { Clock, Duration, Effect } from "effect";

const TRYOUT_EXPIRY_SWEEP_BATCH_SIZE = 100;
const TRYOUT_SCORE_PROMOTION_BATCH_SIZE = 100;

/** Expires one scheduled tryout attempt when its deadline is due. */
export const expireTryoutAttemptInternal = Effect.fn(
  "tryouts.internal.expireTryoutAttemptInternal"
)(function* (args: {
  readonly expiresAtMs: number;
  readonly tryoutAttemptId: Id<"tryoutAttempts">;
}) {
  const reader = yield* DatabaseReader;
  const now = yield* Clock.currentTimeMillis;
  const tryoutAttempt = yield* reader
    .table("tryoutAttempts")
    .get(args.tryoutAttemptId)
    .pipe(Effect.catchTag("GetByIdFailure", () => Effect.succeed(null)));

  if (!tryoutAttempt || tryoutAttempt.status !== "in-progress") {
    return null;
  }

  if (
    args.expiresAtMs < tryoutAttempt.expiresAt ||
    now < tryoutAttempt.expiresAt
  ) {
    return null;
  }

  yield* expireTryoutAttempt(tryoutAttempt, now);
  return null;
});

/** Sweeps expired tryout attempts in bounded batches. */
export const sweepExpiredTryoutAttempts = Effect.fn(
  "tryouts.internal.sweepExpiredTryoutAttempts"
)(function* () {
  const reader = yield* DatabaseReader;
  const scheduler = yield* Scheduler;
  const now = yield* Clock.currentTimeMillis;
  const inProgressAttempts = yield* reader
    .table("tryoutAttempts")
    .index("by_status_and_expiresAt", (query) =>
      query.eq("status", "in-progress").lt("expiresAt", now + 1)
    )
    .take(TRYOUT_EXPIRY_SWEEP_BATCH_SIZE);

  for (const tryoutAttempt of inProgressAttempts) {
    yield* syncTryoutAttemptExpiry(tryoutAttempt, now);
  }

  if (inProgressAttempts.length < TRYOUT_EXPIRY_SWEEP_BATCH_SIZE) {
    return null;
  }

  yield* scheduler.runAfter(
    Duration.millis(0),
    refs.internal.tryouts.mutations.internalFunctions.expiry
      .sweepExpiredTryoutAttempts,
    {}
  );

  return null;
});

/** Promotes completed provisional attempts after a scale becomes official. */
export const promoteProvisionalTryoutScores = Effect.fn(
  "tryouts.internal.promoteProvisionalTryoutScores"
)(function* (args: {
  readonly scaleVersionId: Id<"irtScaleVersions">;
  readonly tryoutId: Id<"tryouts">;
}) {
  const ctx = yield* MutationCtx;
  const reader = yield* DatabaseReader;
  const scheduler = yield* Scheduler;
  const scaleVersion = yield* reader
    .table("irtScaleVersions")
    .get(args.scaleVersionId)
    .pipe(Effect.catchTag("GetByIdFailure", () => Effect.succeed(null)));

  if (!scaleVersion || scaleVersion.status !== "official") {
    return null;
  }

  const completedAttempts = yield* reader
    .table("tryoutAttempts")
    .index("by_tryoutId_and_scoreStatus_and_status_and_startedAt", (query) =>
      query
        .eq("tryoutId", args.tryoutId)
        .eq("scoreStatus", "provisional")
        .eq("status", "completed")
    )
    .take(TRYOUT_SCORE_PROMOTION_BATCH_SIZE);
  const remainingSlots =
    TRYOUT_SCORE_PROMOTION_BATCH_SIZE - completedAttempts.length;
  const expiredAttempts =
    remainingSlots > 0
      ? yield* reader
          .table("tryoutAttempts")
          .index(
            "by_tryoutId_and_scoreStatus_and_status_and_startedAt",
            (query) =>
              query
                .eq("tryoutId", args.tryoutId)
                .eq("scoreStatus", "provisional")
                .eq("status", "expired")
          )
          .take(remainingSlots)
      : completedAttempts.slice(0, 0);
  const provisionalAttempts = [...completedAttempts, ...expiredAttempts];

  if (provisionalAttempts.length === 0) {
    return null;
  }

  const now = yield* Clock.currentTimeMillis;

  for (const tryoutAttempt of provisionalAttempts) {
    const finalizedStatus =
      tryoutAttempt.status === "completed" ? "completed" : "expired";

    yield* syncTryoutAttemptAggregates({
      completedAtMs: tryoutAttempt.completedAt ?? now,
      now,
      scaleVersionId: scaleVersion._id,
      scoreStatus: "official",
      status: finalizedStatus,
      tryoutAttemptId: tryoutAttempt._id,
    });

    if (finalizedStatus !== "completed") {
      continue;
    }

    yield* Effect.promise(() =>
      tryoutLeaderboardWorkpool.enqueueMutation(
        ctx,
        toConvexReference(
          refs.internal.tryouts.mutations.internalFunctions.leaderboard
            .updateLeaderboard
        ),
        { tryoutAttemptId: tryoutAttempt._id }
      )
    );
  }

  if (provisionalAttempts.length < TRYOUT_SCORE_PROMOTION_BATCH_SIZE) {
    return null;
  }

  yield* scheduler.runAfter(
    Duration.millis(0),
    refs.internal.tryouts.mutations.internalFunctions.scoring
      .promoteProvisionalTryoutScores,
    args
  );

  return null;
});
