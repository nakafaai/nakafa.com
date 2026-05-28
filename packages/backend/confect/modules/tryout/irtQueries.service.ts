import type { Id } from "@repo/backend/confect/_generated/dataModel";
import { DatabaseReader } from "@repo/backend/confect/_generated/services";
import { IrtError } from "@repo/backend/confect/modules/tryout/irt.errors";
import { getCalibrationAttemptCacheLimit } from "@repo/backend/confect/modules/tryout/irt.policy";
import { Effect, Option } from "effect";

interface PaginationOpts {
  readonly cursor: string | null;
  readonly endCursor?: string | null;
  readonly id?: number;
  readonly maximumBytesRead?: number;
  readonly maximumRowsRead?: number;
  readonly numItems: number;
}

/** Loads ordered questions and existing item params for one calibration set. */
export const getCalibrationQuestionsForSet = Effect.fn(
  "irt.queries.getCalibrationQuestionsForSet"
)(function* (args: { readonly setId: Id<"exerciseSets"> }) {
  const reader = yield* DatabaseReader;
  const set = yield* reader
    .table("exerciseSets")
    .get(args.setId)
    .pipe(Effect.catchTag("GetByIdFailure", () => Effect.succeed(null)));

  if (!set) {
    return yield* Effect.fail(
      new IrtError({
        code: "IRT_SET_NOT_FOUND",
        message: "Exercise set not found for calibration question lookup.",
      })
    );
  }

  const [questions, existingParams] = yield* Effect.all(
    [
      reader
        .table("exerciseQuestions")
        .index("by_setId", (query) => query.eq("setId", args.setId))
        .take(set.questionCount + 1),
      reader
        .table("exerciseItemParameters")
        .index("by_setId", (query) => query.eq("setId", args.setId))
        .take(set.questionCount + 1),
    ],
    { concurrency: "unbounded" }
  );

  if (questions.length > set.questionCount) {
    return yield* Effect.fail(
      new IrtError({
        code: "IRT_QUESTION_COUNT_EXCEEDED",
        message: "Exercise question count exceeds the set question count.",
      })
    );
  }

  if (existingParams.length > set.questionCount) {
    return yield* Effect.fail(
      new IrtError({
        code: "IRT_ITEM_PARAMETER_COUNT_EXCEEDED",
        message:
          "Exercise item parameter count exceeds the set question count.",
      })
    );
  }

  return {
    existingParams: existingParams.map((params) => ({
      calibrationStatus: params.calibrationStatus,
      correctRate: params.correctRate,
      difficulty: params.difficulty,
      discrimination: params.discrimination,
      questionId: params.questionId,
      responseCount: params.responseCount,
    })),
    questions: [...questions]
      .sort((left, right) => left.number - right.number)
      .map((question) => ({
        questionId: question._id,
      })),
  };
});

/** Loads a flattened page of cached calibration responses for one set. */
export const getCalibrationResponsesPageForSet = Effect.fn(
  "irt.queries.getCalibrationResponsesPageForSet"
)(function* (args: {
  readonly paginationOpts: PaginationOpts;
  readonly setId: Id<"exerciseSets">;
}) {
  const reader = yield* DatabaseReader;
  const set = yield* reader
    .table("exerciseSets")
    .get(args.setId)
    .pipe(Effect.catchTag("GetByIdFailure", () => Effect.succeed(null)));

  if (!set) {
    return yield* Effect.fail(
      new IrtError({
        code: "IRT_SET_NOT_FOUND",
        message: "Exercise set not found for calibration response lookup.",
      })
    );
  }

  const responsePage = yield* reader
    .table("irtCalibrationAttempts")
    .index("by_setId_and_attemptId", (query) => query.eq("setId", args.setId))
    .paginate(args.paginationOpts);

  for (const attempt of responsePage.page) {
    if (attempt.responses.length <= set.questionCount) {
      continue;
    }

    return yield* Effect.fail(
      new IrtError({
        code: "IRT_CALIBRATION_RESPONSE_COUNT_EXCEEDED",
        message:
          "Cached calibration response count exceeds the set question count.",
      })
    );
  }

  return {
    continueCursor: responsePage.continueCursor,
    isDone: responsePage.isDone,
    page: responsePage.page.flatMap((attempt) =>
      attempt.responses.map((response) => ({
        attemptId: attempt.attemptId,
        isCorrect: response.isCorrect,
        questionId: response.questionId,
      }))
    ),
  };
});

/** Caches latest completed run starts while checking queue integrity. */
const getLatestCompletedCalibrationRunStartedAt = Effect.fn(
  "irt.queries.getLatestCompletedCalibrationRunStartedAt"
)(function* (
  cache: Map<Id<"exerciseSets">, number | undefined>,
  setId: Id<"exerciseSets">
) {
  if (cache.has(setId)) {
    return cache.get(setId);
  }

  const reader = yield* DatabaseReader;
  const latestCompletedRun = yield* reader
    .table("irtCalibrationRuns")
    .index(
      "by_setId_and_status_and_startedAt",
      (query) => query.eq("setId", setId).eq("status", "completed"),
      "desc"
    )
    .first();
  const startedAt = Option.getOrUndefined(latestCompletedRun)?.startedAt;
  cache.set(setId, startedAt);
  return startedAt;
});

/** Checks cache stats integrity for exercise sets. */
export const getCalibrationCacheIntegrity = Effect.fn(
  "irt.queries.getCalibrationCacheIntegrity"
)(function* (args: { readonly paginationOpts: PaginationOpts }) {
  const reader = yield* DatabaseReader;
  const sets = yield* reader
    .table("exerciseSets")
    .index("by_syncedAt")
    .paginate(args.paginationOpts);
  let missingStatsSetCount = 0;
  let oversizedSetCount = 0;

  for (const set of sets.page) {
    const cacheStats = yield* reader
      .table("irtCalibrationCacheStats")
      .get("by_setId", set._id)
      .pipe(Effect.catchTag("GetByIndexFailure", () => Effect.succeed(null)));

    if (!cacheStats) {
      const cachedAttempt = yield* reader
        .table("irtCalibrationAttempts")
        .index("by_setId", (query) => query.eq("setId", set._id))
        .first();

      if (Option.isSome(cachedAttempt)) {
        missingStatsSetCount += 1;
      }

      continue;
    }

    if (
      cacheStats.attemptCount <=
      getCalibrationAttemptCacheLimit(set.questionCount)
    ) {
      continue;
    }

    oversizedSetCount += 1;
  }

  return {
    continueCursor: sets.continueCursor,
    isDone: sets.isDone,
    missingStatsSetCount,
    oversizedSetCount,
  };
});

/** Checks active tryouts for scale quality and startability gaps. */
export const getScaleQualityIntegrity = Effect.fn(
  "irt.queries.getScaleQualityIntegrity"
)(function* (args: { readonly paginationOpts: PaginationOpts }) {
  const reader = yield* DatabaseReader;
  const tryouts = yield* reader
    .table("tryouts")
    .index("by_isActive", (query) => query.eq("isActive", true))
    .paginate(args.paginationOpts);
  let missingQualityCheckTryoutCount = 0;
  let unstartableTryoutCount = 0;

  for (const tryout of tryouts.page) {
    const qualityCheck = yield* reader
      .table("irtScaleQualityChecks")
      .get("by_tryoutId", tryout._id)
      .pipe(Effect.catchTag("GetByIndexFailure", () => Effect.succeed(null)));
    const latestScaleVersion = yield* reader
      .table("irtScaleVersions")
      .index(
        "by_tryoutId_and_publishedAt",
        (query) => query.eq("tryoutId", tryout._id),
        "desc"
      )
      .first();

    if (!qualityCheck) {
      missingQualityCheckTryoutCount += 1;
    }

    if (Option.isNone(latestScaleVersion)) {
      unstartableTryoutCount += 1;
    }
  }

  return {
    continueCursor: tryouts.continueCursor,
    isDone: tryouts.isDone,
    missingQualityCheckTryoutCount,
    unstartableTryoutCount,
  };
});

/** Checks cached calibration attempts that should still have pending queue rows. */
export const getCalibrationQueueAttemptIntegrity = Effect.fn(
  "irt.queries.getCalibrationQueueAttemptIntegrity"
)(function* (args: { readonly paginationOpts: PaginationOpts }) {
  const reader = yield* DatabaseReader;
  const attempts = yield* reader
    .table("irtCalibrationAttempts")
    .index("by_setId")
    .paginate(args.paginationOpts);
  const latestCompletedRunStartedAtBySetId = new Map<
    Id<"exerciseSets">,
    number | undefined
  >();
  let duplicatePendingAttemptCount = 0;
  let missingPendingQueueAttemptCount = 0;
  let staleAttemptQueueSetCount = 0;

  for (const attempt of attempts.page) {
    const latestCompletedRunStartedAt =
      yield* getLatestCompletedCalibrationRunStartedAt(
        latestCompletedRunStartedAtBySetId,
        attempt.setId
      );

    if (
      latestCompletedRunStartedAt !== undefined &&
      attempt._creationTime <= latestCompletedRunStartedAt
    ) {
      continue;
    }

    const queueEntries = yield* reader
      .table("irtCalibrationQueue")
      .index("by_attemptId_and_enqueuedAt", (query) =>
        query.eq("attemptId", attempt.attemptId)
      )
      .take(2);

    if (queueEntries.length === 0) {
      missingPendingQueueAttemptCount += 1;
      continue;
    }

    if (queueEntries.length > 1) {
      duplicatePendingAttemptCount += 1;
      continue;
    }

    if (queueEntries[0]?.setId !== attempt.setId) {
      staleAttemptQueueSetCount += 1;
    }
  }

  return {
    continueCursor: attempts.continueCursor,
    duplicatePendingAttemptCount,
    isDone: attempts.isDone,
    missingPendingQueueAttemptCount,
    staleAttemptQueueSetCount,
  };
});

/** Checks pending calibration queue entries for orphaned or stale rows. */
export const getCalibrationQueueEntryIntegrity = Effect.fn(
  "irt.queries.getCalibrationQueueEntryIntegrity"
)(function* (args: { readonly paginationOpts: PaginationOpts }) {
  const reader = yield* DatabaseReader;
  const queueEntries = yield* reader
    .table("irtCalibrationQueue")
    .index("by_enqueuedAt")
    .paginate(args.paginationOpts);
  const latestCompletedRunStartedAtBySetId = new Map<
    Id<"exerciseSets">,
    number | undefined
  >();
  let orphanedQueueEntryCount = 0;
  let staleQueueEntryCount = 0;

  for (const queueEntry of queueEntries.page) {
    const attempt = yield* reader
      .table("irtCalibrationAttempts")
      .get("by_attemptId", queueEntry.attemptId)
      .pipe(Effect.catchTag("GetByIndexFailure", () => Effect.succeed(null)));

    if (!attempt || attempt.setId !== queueEntry.setId) {
      orphanedQueueEntryCount += 1;
      continue;
    }

    const latestCompletedRunStartedAt =
      yield* getLatestCompletedCalibrationRunStartedAt(
        latestCompletedRunStartedAtBySetId,
        queueEntry.setId
      );

    if (
      latestCompletedRunStartedAt !== undefined &&
      queueEntry.enqueuedAt <= latestCompletedRunStartedAt
    ) {
      staleQueueEntryCount += 1;
    }
  }

  return {
    continueCursor: queueEntries.continueCursor,
    isDone: queueEntries.isDone,
    orphanedQueueEntryCount,
    staleQueueEntryCount,
  };
});
