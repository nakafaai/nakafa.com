import type { Id } from "@repo/backend/confect/_generated/dataModel";
import { QueryCtx } from "@repo/backend/confect/_generated/services";
import type { ConvexQueryCtx } from "@repo/backend/confect/modules/shared/convexContext";
import { IrtError } from "@repo/backend/confect/modules/tryout/irt.errors";
import { getCalibrationAttemptCacheLimit } from "@repo/backend/confect/modules/tryout/irt.policy";
import { getLatestScaleVersionForTryout } from "@repo/backend/confect/modules/tryout/irtScaleRead.service";
import { Effect } from "effect";

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
  const ctx = yield* QueryCtx;
  const set = yield* Effect.promise(() => ctx.db.get(args.setId));

  if (!set) {
    return yield* Effect.fail(
      new IrtError({
        code: "IRT_SET_NOT_FOUND",
        message: "Exercise set not found for calibration question lookup.",
      })
    );
  }

  const [questions, existingParams] = yield* Effect.promise(() =>
    Promise.all([
      ctx.db
        .query("exerciseQuestions")
        .withIndex("by_setId", (query) => query.eq("setId", args.setId))
        .take(set.questionCount + 1),
      ctx.db
        .query("exerciseItemParameters")
        .withIndex("by_setId", (query) => query.eq("setId", args.setId))
        .take(set.questionCount + 1),
    ])
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
  const ctx = yield* QueryCtx;
  const set = yield* Effect.promise(() => ctx.db.get(args.setId));

  if (!set) {
    return yield* Effect.fail(
      new IrtError({
        code: "IRT_SET_NOT_FOUND",
        message: "Exercise set not found for calibration response lookup.",
      })
    );
  }

  const responsePage = yield* Effect.promise(() =>
    ctx.db
      .query("irtCalibrationAttempts")
      .withIndex("by_setId_and_attemptId", (query) =>
        query.eq("setId", args.setId)
      )
      .paginate(args.paginationOpts)
  );

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
  ctx: ConvexQueryCtx,
  cache: Map<Id<"exerciseSets">, number | undefined>,
  setId: Id<"exerciseSets">
) {
  if (cache.has(setId)) {
    return cache.get(setId);
  }

  const latestCompletedRun = yield* Effect.promise(() =>
    ctx.db
      .query("irtCalibrationRuns")
      .withIndex("by_setId_and_status_and_startedAt", (query) =>
        query.eq("setId", setId).eq("status", "completed")
      )
      .order("desc")
      .first()
  );
  const startedAt = latestCompletedRun?.startedAt;
  cache.set(setId, startedAt);
  return startedAt;
});

/** Checks cache stats integrity for exercise sets. */
export const getCalibrationCacheIntegrity = Effect.fn(
  "irt.queries.getCalibrationCacheIntegrity"
)(function* (args: { readonly paginationOpts: PaginationOpts }) {
  const ctx = yield* QueryCtx;
  const sets = yield* Effect.promise(() =>
    ctx.db.query("exerciseSets").paginate(args.paginationOpts)
  );
  let missingStatsSetCount = 0;
  let oversizedSetCount = 0;

  for (const set of sets.page) {
    const cacheStats = yield* Effect.promise(() =>
      ctx.db
        .query("irtCalibrationCacheStats")
        .withIndex("by_setId", (query) => query.eq("setId", set._id))
        .unique()
    );

    if (!cacheStats) {
      const cachedAttempt = yield* Effect.promise(() =>
        ctx.db
          .query("irtCalibrationAttempts")
          .withIndex("by_setId", (query) => query.eq("setId", set._id))
          .first()
      );

      if (cachedAttempt) {
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
  const ctx = yield* QueryCtx;
  const tryouts = yield* Effect.promise(() =>
    ctx.db
      .query("tryouts")
      .withIndex("by_isActive", (query) => query.eq("isActive", true))
      .paginate(args.paginationOpts)
  );
  let missingQualityCheckTryoutCount = 0;
  let unstartableTryoutCount = 0;

  for (const tryout of tryouts.page) {
    const qualityCheck = yield* Effect.promise(() =>
      ctx.db
        .query("irtScaleQualityChecks")
        .withIndex("by_tryoutId", (query) => query.eq("tryoutId", tryout._id))
        .unique()
    );
    const latestScaleVersion = yield* getLatestScaleVersionForTryout(
      ctx.db,
      tryout._id
    );

    if (!qualityCheck) {
      missingQualityCheckTryoutCount += 1;
    }

    if (!latestScaleVersion) {
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
  const ctx = yield* QueryCtx;
  const attempts = yield* Effect.promise(() =>
    ctx.db.query("irtCalibrationAttempts").paginate(args.paginationOpts)
  );
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
        ctx,
        latestCompletedRunStartedAtBySetId,
        attempt.setId
      );

    if (
      latestCompletedRunStartedAt !== undefined &&
      attempt._creationTime <= latestCompletedRunStartedAt
    ) {
      continue;
    }

    const queueEntries = yield* Effect.promise(() =>
      ctx.db
        .query("irtCalibrationQueue")
        .withIndex("by_attemptId_and_enqueuedAt", (query) =>
          query.eq("attemptId", attempt.attemptId)
        )
        .take(2)
    );

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
  const ctx = yield* QueryCtx;
  const queueEntries = yield* Effect.promise(() =>
    ctx.db
      .query("irtCalibrationQueue")
      .withIndex("by_enqueuedAt")
      .paginate(args.paginationOpts)
  );
  const latestCompletedRunStartedAtBySetId = new Map<
    Id<"exerciseSets">,
    number | undefined
  >();
  let orphanedQueueEntryCount = 0;
  let staleQueueEntryCount = 0;

  for (const queueEntry of queueEntries.page) {
    const attempt = yield* Effect.promise(() =>
      ctx.db
        .query("irtCalibrationAttempts")
        .withIndex("by_attemptId", (query) =>
          query.eq("attemptId", queueEntry.attemptId)
        )
        .unique()
    );

    if (!attempt || attempt.setId !== queueEntry.setId) {
      orphanedQueueEntryCount += 1;
      continue;
    }

    const latestCompletedRunStartedAt =
      yield* getLatestCompletedCalibrationRunStartedAt(
        ctx,
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
