import type { Doc, Id } from "@repo/backend/confect/_generated/dataModel";
import {
  buildFinalizedExerciseAttemptPatch,
  computeAttemptDurationSeconds,
} from "@repo/backend/confect/modules/learning/exerciseAttemptUtils.service";
import type { ConvexMutationCtx } from "@repo/backend/confect/modules/shared/convexContext";
import { getScaleVersionItemsForSet } from "@repo/backend/confect/modules/tryout/irtScaleRead.service";
import { TryoutError } from "@repo/backend/confect/modules/tryout/tryout.errors";
import { scoreFinalizedTryoutPart } from "@repo/backend/confect/modules/tryout/tryoutFinalizeScore.service";
import { getBoundedExerciseAnswers } from "@repo/backend/confect/modules/tryout/tryoutLoaders.service";
import { Effect } from "effect";

/** Finalizes the linked exercise attempt for a tryout part when needed. */
const finalizeExerciseSetAttemptIfNeeded = Effect.fn(
  "tryouts.finalize.finalizeExerciseSetAttemptIfNeeded"
)(function* (
  ctx: ConvexMutationCtx,
  args: {
    readonly finishedAtMs: number;
    readonly now: number;
    readonly setAttempt: Doc<"exerciseAttempts">;
    readonly status: "completed" | "expired";
  }
) {
  if (args.setAttempt.status !== "in-progress") {
    return args.setAttempt;
  }

  const schedulerId = args.setAttempt.schedulerId;

  if (schedulerId) {
    yield* Effect.promise(() => ctx.scheduler.cancel(schedulerId));
  }

  const setExpiresAtMs =
    args.setAttempt.startedAt + args.setAttempt.timeLimit * 1e3;
  const completedAt = Math.min(args.finishedAtMs, setExpiresAtMs);
  const finalStatus =
    args.status === "expired" || args.finishedAtMs >= setExpiresAtMs
      ? "expired"
      : "completed";
  const totalTime = computeAttemptDurationSeconds({
    completedAtMs: completedAt,
    startedAtMs: args.setAttempt.startedAt,
  });
  const finalizedSetAttempt = {
    ...args.setAttempt,
    ...buildFinalizedExerciseAttemptPatch({
      completedAtMs: completedAt,
      now: args.now,
      status: finalStatus,
      totalTime,
    }),
  };

  yield* Effect.promise(() =>
    ctx.db.patch(
      args.setAttempt._id,
      buildFinalizedExerciseAttemptPatch({
        completedAtMs: completedAt,
        now: args.now,
        status: finalStatus,
        totalTime,
      })
    )
  );

  return finalizedSetAttempt;
});

/** Finalizes one tryout part attempt and records its IRT score. */
export const finalizeTryoutPartAttempt = Effect.fn(
  "tryouts.finalize.finalizeTryoutPartAttempt"
)(function* (args: {
  readonly ctx: ConvexMutationCtx;
  readonly finishedAtMs: number;
  readonly now: number;
  readonly partAttempt: Doc<"tryoutPartAttempts">;
  readonly status: "completed" | "expired";
  readonly tryoutAttemptId: Id<"tryoutAttempts">;
}) {
  const [setAttempt, tryoutAttempt] = yield* Effect.promise(() =>
    Promise.all([
      args.ctx.db.get(args.partAttempt.setAttemptId),
      args.ctx.db.get(args.tryoutAttemptId),
    ])
  );

  if (!setAttempt) {
    return yield* Effect.fail(
      new TryoutError({
        code: "SET_ATTEMPT_NOT_FOUND",
        message: "Exercise set attempt not found.",
      })
    );
  }

  if (!tryoutAttempt) {
    return yield* Effect.fail(
      new TryoutError({
        code: "ATTEMPT_NOT_FOUND",
        message: "Tryout attempt not found.",
      })
    );
  }

  const isAlreadyFinalized = tryoutAttempt.completedPartIndices.includes(
    args.partAttempt.partIndex
  );
  const currentSetAttempt = yield* finalizeExerciseSetAttemptIfNeeded(
    args.ctx,
    {
      finishedAtMs: args.finishedAtMs,
      now: args.now,
      setAttempt,
      status: args.status,
    }
  );

  if (isAlreadyFinalized) {
    return {
      rawScore: currentSetAttempt.correctAnswers,
      theta: args.partAttempt.theta,
      thetaSE: args.partAttempt.thetaSE,
      totalQuestions: currentSetAttempt.totalExercises,
    };
  }

  const answers = yield* getBoundedExerciseAnswers(args.ctx.db, {
    attemptId: args.partAttempt.setAttemptId,
    totalExercises: currentSetAttempt.totalExercises,
  });
  const itemParamsRecords = yield* getScaleVersionItemsForSet(args.ctx.db, {
    questionCount: currentSetAttempt.totalExercises,
    scaleVersionId: tryoutAttempt.scaleVersionId,
    setId: args.partAttempt.setId,
  });
  const partScore = scoreFinalizedTryoutPart({
    answers,
    itemParamsRecords,
    totalQuestions: currentSetAttempt.totalExercises,
  });
  const completedPartIndices = [...tryoutAttempt.completedPartIndices];

  if (!completedPartIndices.includes(args.partAttempt.partIndex)) {
    completedPartIndices.push(args.partAttempt.partIndex);
    completedPartIndices.sort((left, right) => left - right);
  }

  yield* Effect.promise(() =>
    Promise.all([
      args.ctx.db.patch(args.partAttempt._id, {
        theta: partScore.theta,
        thetaSE: partScore.thetaSE,
      }),
      args.ctx.db.patch(tryoutAttempt._id, {
        completedPartIndices,
        lastActivityAt: args.now,
      }),
    ])
  );

  return {
    rawScore: partScore.rawScore,
    theta: partScore.theta,
    thetaSE: partScore.thetaSE,
    totalQuestions: partScore.totalQuestions,
  };
});
