import type { Id } from "@repo/backend/confect/_generated/dataModel";
import {
  DatabaseReader,
  DatabaseWriter,
} from "@repo/backend/confect/_generated/services";
import {
  type FinalizedAttemptStatus,
  getAttemptEndReasonFromStatus,
} from "@repo/backend/confect/modules/learning/attempts.schemas";
import { TryoutError } from "@repo/backend/confect/modules/tryout/tryout.errors";
import { buildFinalizedTryoutSnapshot } from "@repo/backend/confect/modules/tryout/tryoutFinalizeSnapshot.service";
import { computeTryoutRawScorePercentage } from "@repo/backend/confect/modules/tryout/tryoutMetrics.service";
import type { TryoutScoreStatus } from "@repo/backend/confect/modules/tryout/tryouts.tables";
import { Effect } from "effect";

/** Synchronizes persisted aggregate score fields for a tryout attempt. */
export const syncTryoutAttemptAggregates = Effect.fnUntraced(function* (args: {
  readonly completedAtMs: number;
  readonly scaleVersionId?: Id<"irtScaleVersions">;
  readonly scoreStatus?: TryoutScoreStatus;
  readonly status: FinalizedAttemptStatus;
  readonly tryoutAttemptId: Id<"tryoutAttempts">;
  readonly now: number;
}) {
  const reader = yield* DatabaseReader;
  const writer = yield* DatabaseWriter;
  const tryoutAttempt = yield* reader
    .table("tryoutAttempts")
    .get(args.tryoutAttemptId)
    .pipe(Effect.catchTag("GetByIdFailure", () => Effect.succeed(null)));

  if (!tryoutAttempt) {
    return yield* Effect.fail(
      new TryoutError({
        code: "ATTEMPT_NOT_FOUND",
        message: "Tryout attempt not found.",
      })
    );
  }

  const tryout = yield* reader
    .table("tryouts")
    .get(tryoutAttempt.tryoutId)
    .pipe(Effect.catchTag("GetByIdFailure", () => Effect.succeed(null)));

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
  const snapshot = yield* buildFinalizedTryoutSnapshot({
    scaleVersionId: effectiveScaleVersionId,
    tryout,
    tryoutAttempt,
  });

  for (const partSnapshot of snapshot.partSnapshots) {
    const partAttempt = partSnapshot.partAttempt;

    if (!partAttempt) {
      continue;
    }

    yield* writer.table("tryoutPartAttempts").patch(partAttempt._id, {
      theta: partSnapshot.score.theta,
      thetaSE: partSnapshot.score.thetaSE,
    });
  }

  yield* writer.table("tryoutAttempts").patch(args.tryoutAttemptId, {
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
  });

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
