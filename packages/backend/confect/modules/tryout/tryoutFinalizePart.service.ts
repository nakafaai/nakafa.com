import type { Id } from "@repo/backend/confect/_generated/dataModel";
import {
  DatabaseReader,
  DatabaseWriter,
} from "@repo/backend/confect/_generated/services";
import type { FinalizedAttemptStatus } from "@repo/backend/confect/modules/learning/attempts.schemas";
import {
  buildFinalizedExerciseAttemptPatch,
  computeAttemptDurationSeconds,
} from "@repo/backend/confect/modules/learning/exerciseAttemptUtils.service";
import type { ExerciseAttempts } from "@repo/backend/confect/modules/learning/exercises.tables";
import { getScaleVersionItemsForSet } from "@repo/backend/confect/modules/tryout/irtScaleRead.service";
import { TryoutError } from "@repo/backend/confect/modules/tryout/tryout.errors";
import { scoreFinalizedTryoutPart } from "@repo/backend/confect/modules/tryout/tryoutFinalizeScore.service";
import { getBoundedExerciseAnswers } from "@repo/backend/confect/modules/tryout/tryoutLoaders.service";
import type { TryoutPartAttempts } from "@repo/backend/confect/modules/tryout/tryouts.tables";
import { Effect } from "effect";

type ExerciseAttemptDoc = typeof ExerciseAttempts.Doc.Type;
type TryoutPartAttemptDoc = typeof TryoutPartAttempts.Doc.Type;

/** Finalizes the linked exercise attempt for a tryout part when needed. */
const finalizeExerciseSetAttemptIfNeeded = Effect.fn(
  "tryouts.finalize.finalizeExerciseSetAttemptIfNeeded"
)(function* (args: {
  readonly finishedAtMs: number;
  readonly now: number;
  readonly setAttempt: ExerciseAttemptDoc;
  readonly status: FinalizedAttemptStatus;
}) {
  if (args.setAttempt.status !== "in-progress") {
    return args.setAttempt;
  }

  const writer = yield* DatabaseWriter;
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

  yield* writer.table("exerciseAttempts").patch(
    args.setAttempt._id,
    buildFinalizedExerciseAttemptPatch({
      completedAtMs: completedAt,
      now: args.now,
      status: finalStatus,
      totalTime,
    })
  );

  return finalizedSetAttempt;
});

/** Finalizes one tryout part attempt and records its IRT score. */
export const finalizeTryoutPartAttempt = Effect.fn(
  "tryouts.finalize.finalizeTryoutPartAttempt"
)(function* (args: {
  readonly finishedAtMs: number;
  readonly now: number;
  readonly partAttempt: TryoutPartAttemptDoc;
  readonly status: FinalizedAttemptStatus;
  readonly tryoutAttemptId: Id<"tryoutAttempts">;
}) {
  const reader = yield* DatabaseReader;
  const writer = yield* DatabaseWriter;
  const [setAttempt, tryoutAttempt] = yield* Effect.all([
    reader
      .table("exerciseAttempts")
      .get(args.partAttempt.setAttemptId)
      .pipe(Effect.catchTag("GetByIdFailure", () => Effect.succeed(null))),
    reader
      .table("tryoutAttempts")
      .get(args.tryoutAttemptId)
      .pipe(Effect.catchTag("GetByIdFailure", () => Effect.succeed(null))),
  ]);

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
  const currentSetAttempt = yield* finalizeExerciseSetAttemptIfNeeded({
    finishedAtMs: args.finishedAtMs,
    now: args.now,
    setAttempt,
    status: args.status,
  });

  if (isAlreadyFinalized) {
    return {
      rawScore: currentSetAttempt.correctAnswers,
      theta: args.partAttempt.theta,
      thetaSE: args.partAttempt.thetaSE,
      totalQuestions: currentSetAttempt.totalExercises,
    };
  }

  const answers = yield* getBoundedExerciseAnswers({
    attemptId: args.partAttempt.setAttemptId,
    totalExercises: currentSetAttempt.totalExercises,
  });
  const itemParamsRecords = yield* getScaleVersionItemsForSet({
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

  yield* Effect.all([
    writer.table("tryoutPartAttempts").patch(args.partAttempt._id, {
      theta: partScore.theta,
      thetaSE: partScore.thetaSE,
    }),
    writer.table("tryoutAttempts").patch(tryoutAttempt._id, {
      completedPartIndices,
      lastActivityAt: args.now,
    }),
  ]);

  return {
    rawScore: partScore.rawScore,
    theta: partScore.theta,
    thetaSE: partScore.thetaSE,
    totalQuestions: partScore.totalQuestions,
  };
});
