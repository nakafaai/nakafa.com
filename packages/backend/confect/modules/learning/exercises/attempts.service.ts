import type { Doc, Id } from "@repo/backend/confect/_generated/dataModel";
import refs from "@repo/backend/confect/_generated/refs";
import {
  DatabaseReader,
  DatabaseWriter,
  MutationCtx,
  Scheduler,
} from "@repo/backend/confect/_generated/services";
import { requireAppUser } from "@repo/backend/confect/modules/identity/auth.service";
import {
  buildFinalizedExerciseAttemptPatch,
  computeAttemptDurationSeconds,
} from "@repo/backend/confect/modules/learning/exerciseAttemptUtils.service";
import { failExercise } from "@repo/backend/confect/modules/learning/exercises/errors.service";
import type {
  ExerciseAttemptMode,
  ExerciseAttemptOrigin,
  ExerciseAttemptScope,
} from "@repo/backend/confect/modules/learning/exercises.tables";
import type { ConvexMutationCtx } from "@repo/backend/confect/modules/shared/convexContext";
import { toConvexReference } from "@repo/backend/confect/modules/shared/convexReferences";
import { irtCalibrationSyncWorkpool } from "@repo/backend/confect/modules/tryout/irtWorkpool";
import { finalizeTryoutAttempt } from "@repo/backend/confect/modules/tryout/tryoutFinalizeAttempt.service";
import { finalizeTryoutPartAttempt } from "@repo/backend/confect/modules/tryout/tryoutFinalizePart.service";
import { Clock, Duration, Effect, Option } from "effect";

/** Schedules IRT calibration sync for a completed simulation set attempt. */
function scheduleCalibrationSyncIfReady(
  ctx: ConvexMutationCtx,
  attempt: Doc<"exerciseAttempts">
) {
  if (
    attempt.scope !== "set" ||
    attempt.mode !== "simulation" ||
    attempt.status !== "completed"
  ) {
    return Effect.succeed(null);
  }

  return Effect.promise(() =>
    irtCalibrationSyncWorkpool.enqueueMutation(
      ctx,
      toConvexReference(
        refs.internal.irt.mutations.internalFunctions.responses
          .syncCalibrationResponsesForAttempt
      ),
      { attemptId: attempt._id }
    )
  );
}

/** Creates and schedules one exercise attempt. */
export const createExerciseAttempt = Effect.fn(
  "exercises.createExerciseAttempt"
)(function* (args: {
  readonly exerciseNumber?: number;
  readonly mode: ExerciseAttemptMode;
  readonly origin: ExerciseAttemptOrigin;
  readonly perQuestionTimeLimit?: number;
  readonly scope: ExerciseAttemptScope;
  readonly slug: string;
  readonly startedAt: number;
  readonly timeLimit: number;
  readonly totalExercises: number;
  readonly userId: Id<"users">;
}) {
  const writer = yield* DatabaseWriter;
  const scheduler = yield* Scheduler;
  const attemptId = yield* writer.table("exerciseAttempts").insert({
    answeredCount: 0,
    completedAt: null,
    correctAnswers: 0,
    endReason: null,
    exerciseNumber: args.scope === "single" ? args.exerciseNumber : undefined,
    lastActivityAt: args.startedAt,
    mode: args.mode,
    origin: args.origin,
    perQuestionTimeLimit: args.perQuestionTimeLimit,
    scope: args.scope,
    scorePercentage: 0,
    slug: args.slug,
    startedAt: args.startedAt,
    status: "in-progress",
    timeLimit: args.timeLimit,
    totalExercises: args.totalExercises,
    totalTime: 0,
    updatedAt: args.startedAt,
    userId: args.userId,
  });
  const expiresAtMs = args.startedAt + args.timeLimit * 1e3;
  const schedulerId = yield* scheduler.runAfter(
    Duration.millis(args.timeLimit * 1e3),
    refs.internal.exercises.mutations.expireAttemptInternal,
    { attemptId, expiresAtMs }
  );

  yield* writer.table("exerciseAttempts").patch(attemptId, { schedulerId });
  return attemptId;
});

/** Starts a standalone exercise attempt for the current user. */
export const startAttempt = Effect.fn("exercises.startAttempt")(
  function* (args: {
    readonly exerciseNumber?: number;
    readonly mode: ExerciseAttemptMode;
    readonly perQuestionTimeLimit?: number;
    readonly scope: ExerciseAttemptScope;
    readonly slug: string;
    readonly timeLimit: number;
    readonly totalExercises: number;
  }) {
    const { appUser } = yield* requireAppUser();
    const now = yield* Clock.currentTimeMillis;

    yield* validateAttemptStartArgs(args);

    return yield* createExerciseAttempt({
      ...args,
      origin: "standalone",
      startedAt: now,
      userId: appUser._id,
    });
  }
);

/** Validates start-attempt input before writing attempt rows. */
function validateAttemptStartArgs(args: {
  readonly exerciseNumber?: number;
  readonly perQuestionTimeLimit?: number;
  readonly scope: ExerciseAttemptScope;
  readonly timeLimit: number;
  readonly totalExercises: number;
}) {
  if (args.totalExercises < 1) {
    return failExercise(
      "INVALID_ARGUMENT",
      "totalExercises must be at least 1."
    );
  }

  if (args.scope === "single") {
    if (!args.exerciseNumber || args.exerciseNumber < 1) {
      return failExercise(
        "INVALID_ARGUMENT",
        "exerciseNumber must be provided and at least 1 for single scope."
      );
    }

    if (args.totalExercises !== 1) {
      return failExercise(
        "INVALID_ARGUMENT",
        "totalExercises must be 1 for single scope."
      );
    }
  }

  if (args.scope === "set" && args.exerciseNumber) {
    return failExercise(
      "INVALID_ARGUMENT",
      "exerciseNumber must be omitted for set scope."
    );
  }

  if (args.timeLimit <= 0) {
    return failExercise(
      "INVALID_ARGUMENT",
      "timeLimit must be greater than 0 when provided."
    );
  }

  if (args.perQuestionTimeLimit && args.perQuestionTimeLimit <= 0) {
    return failExercise(
      "INVALID_ARGUMENT",
      "perQuestionTimeLimit must be greater than 0 when provided."
    );
  }

  return Effect.succeed(null);
}

/** Completes a standalone attempt for the current user. */
export const completeAttempt = Effect.fn("exercises.completeAttempt")(
  function* (args: { readonly attemptId: Id<"exerciseAttempts"> }) {
    const ctx = yield* MutationCtx;
    const reader = yield* DatabaseReader;
    const writer = yield* DatabaseWriter;
    const { appUser } = yield* requireAppUser();
    const now = yield* Clock.currentTimeMillis;
    const attempt = yield* reader
      .table("exerciseAttempts")
      .get(args.attemptId)
      .pipe(Effect.catchTag("GetByIdFailure", () => Effect.succeed(null)));

    if (!attempt) {
      return yield* failExercise("ATTEMPT_NOT_FOUND", "Attempt not found.");
    }

    if (attempt.userId !== appUser._id) {
      return yield* failExercise(
        "FORBIDDEN",
        "You do not have access to this attempt."
      );
    }

    if (attempt.origin === "tryout") {
      return yield* failExercise(
        "INVALID_ATTEMPT_STATE",
        "Tryout attempts must be completed from the tryout flow."
      );
    }

    if (attempt.status === "completed") {
      return { status: "completed" as const };
    }

    if (attempt.status === "expired") {
      return { status: "expired" as const };
    }

    if (attempt.status !== "in-progress") {
      return yield* failExercise(
        "INVALID_ATTEMPT_STATUS",
        "Attempt is not in progress."
      );
    }

    const expiresAtMs = attempt.startedAt + attempt.timeLimit * 1e3;

    if (now >= expiresAtMs) {
      const totalTime = computeAttemptDurationSeconds({
        completedAtMs: expiresAtMs,
        startedAtMs: attempt.startedAt,
      });

      yield* writer.table("exerciseAttempts").patch(
        args.attemptId,
        buildFinalizedExerciseAttemptPatch({
          completedAtMs: expiresAtMs,
          now,
          status: "expired",
          totalTime,
        })
      );

      return { expiredAtMs: expiresAtMs, status: "expired" as const };
    }

    const totalTime = computeAttemptDurationSeconds({
      completedAtMs: now,
      startedAtMs: attempt.startedAt,
    });
    const finalizedAttempt = {
      ...attempt,
      ...buildFinalizedExerciseAttemptPatch({
        completedAtMs: now,
        now,
        status: "completed" as const,
        totalTime,
      }),
    };

    yield* writer.table("exerciseAttempts").patch(
      args.attemptId,
      buildFinalizedExerciseAttemptPatch({
        completedAtMs: now,
        now,
        status: "completed",
        totalTime,
      })
    );
    yield* scheduleCalibrationSyncIfReady(ctx, finalizedAttempt);

    return { status: "completed" as const };
  }
);

/** Expires an attempt from its scheduled internal mutation. */
export const expireAttemptInternal = Effect.fn(
  "exercises.expireAttemptInternal"
)(function* (args: {
  readonly attemptId: Id<"exerciseAttempts">;
  readonly expiresAtMs: number;
}) {
  const ctx = yield* MutationCtx;
  const reader = yield* DatabaseReader;
  const writer = yield* DatabaseWriter;
  const now = yield* Clock.currentTimeMillis;
  const attempt = yield* reader
    .table("exerciseAttempts")
    .get(args.attemptId)
    .pipe(Effect.catchTag("GetByIdFailure", () => Effect.succeed(null)));

  if (!attempt || attempt.status !== "in-progress") {
    return null;
  }

  const computedExpiresAtMs = attempt.startedAt + attempt.timeLimit * 1e3;
  const expiresAtMs = Math.max(args.expiresAtMs, computedExpiresAtMs);

  if (now < expiresAtMs) {
    return null;
  }

  const finalTotalTime = computeAttemptDurationSeconds({
    completedAtMs: expiresAtMs,
    startedAtMs: attempt.startedAt,
  });

  yield* writer.table("exerciseAttempts").patch(
    args.attemptId,
    buildFinalizedExerciseAttemptPatch({
      completedAtMs: expiresAtMs,
      now,
      status: "expired",
      totalTime: finalTotalTime,
    })
  );

  if (attempt.origin !== "tryout") {
    return null;
  }

  const partAttempt = yield* reader
    .table("tryoutPartAttempts")
    .index("by_setAttemptId", (query) => query.eq("setAttemptId", attempt._id))
    .first()
    .pipe(Effect.map(Option.getOrNull));

  if (!partAttempt) {
    return null;
  }

  yield* finalizeTryoutPartAttempt({
    finishedAtMs: expiresAtMs,
    now,
    partAttempt,
    status: "expired",
    tryoutAttemptId: partAttempt.tryoutAttemptId,
  });

  const tryoutAttempt = yield* reader
    .table("tryoutAttempts")
    .get(partAttempt.tryoutAttemptId)
    .pipe(Effect.catchTag("GetByIdFailure", () => Effect.succeed(null)));

  if (!tryoutAttempt) {
    return null;
  }

  yield* finalizeTryoutAttempt({
    completedAtMs: expiresAtMs,
    ctx,
    now,
    tryoutAttempt,
    userId: attempt.userId,
  });

  return null;
});
