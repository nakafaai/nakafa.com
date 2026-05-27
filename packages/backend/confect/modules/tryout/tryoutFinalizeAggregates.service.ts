import type { Id } from "@repo/backend/confect/_generated/dataModel";
import { getAttemptEndReasonFromStatus } from "@repo/backend/confect/modules/learning/attempts.schemas";
import type { ConvexMutationCtx } from "@repo/backend/confect/modules/shared/convexContext";
import { TryoutError } from "@repo/backend/confect/modules/tryout/tryout.errors";
import { buildFinalizedTryoutSnapshot } from "@repo/backend/confect/modules/tryout/tryoutFinalizeSnapshot.service";
import { computeTryoutRawScorePercentage } from "@repo/backend/confect/modules/tryout/tryoutMetrics.service";
import { Effect } from "effect";

/** Synchronizes persisted aggregate score fields for a tryout attempt. */
export const syncTryoutAttemptAggregates = Effect.fn(
  "tryouts.finalize.syncTryoutAttemptAggregates"
)(function* (
  ctx: ConvexMutationCtx,
  args: {
    readonly completedAtMs: number;
    readonly scaleVersionId?: Id<"irtScaleVersions">;
    readonly scoreStatus?: "official" | "provisional";
    readonly status: "completed" | "expired";
    readonly tryoutAttemptId: Id<"tryoutAttempts">;
    readonly now: number;
  }
) {
  const tryoutAttempt = yield* Effect.promise(() =>
    ctx.db.get(args.tryoutAttemptId)
  );

  if (!tryoutAttempt) {
    return yield* Effect.fail(
      new TryoutError({
        code: "ATTEMPT_NOT_FOUND",
        message: "Tryout attempt not found.",
      })
    );
  }

  const tryout = yield* Effect.promise(() =>
    ctx.db.get(tryoutAttempt.tryoutId)
  );

  if (!tryout) {
    return yield* Effect.fail(
      new TryoutError({
        code: "TRYOUT_NOT_FOUND",
        message: "Tryout not found.",
      })
    );
  }

  const effectiveScaleVersionId =
    args.scaleVersionId ?? tryoutAttempt.scaleVersionId;
  const effectiveScoreStatus = args.scoreStatus ?? tryoutAttempt.scoreStatus;
  const snapshot = yield* buildFinalizedTryoutSnapshot(ctx.db, {
    scaleVersionId: effectiveScaleVersionId,
    tryout,
    tryoutAttempt,
  });

  for (const partSnapshot of snapshot.partSnapshots) {
    const partAttempt = partSnapshot.partAttempt;

    if (!partAttempt) {
      continue;
    }

    yield* Effect.promise(() =>
      ctx.db.patch(partAttempt._id, {
        theta: partSnapshot.score.theta,
        thetaSE: partSnapshot.score.thetaSE,
      })
    );
  }

  yield* Effect.promise(() =>
    ctx.db.patch(args.tryoutAttemptId, {
      completedAt: args.completedAtMs,
      endReason: getAttemptEndReasonFromStatus(args.status),
      lastActivityAt: args.now,
      scaleVersionId: effectiveScaleVersionId,
      scoreStatus: effectiveScoreStatus,
      status: args.status,
      theta: snapshot.theta,
      thetaSE: snapshot.thetaSE,
      totalCorrect: snapshot.totalCorrect,
      totalQuestions: snapshot.totalQuestions,
    })
  );

  return {
    irtScore: snapshot.irtScore,
    rawScorePercentage: computeTryoutRawScorePercentage({
      totalCorrect: snapshot.totalCorrect,
      totalQuestions: snapshot.totalQuestions,
    }),
    status: args.status,
    theta: snapshot.theta,
    thetaSE: snapshot.thetaSE,
  };
});
