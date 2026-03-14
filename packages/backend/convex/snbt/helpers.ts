import type { Doc } from "@repo/backend/convex/_generated/dataModel";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import { computeAttemptDurationSeconds } from "@repo/backend/convex/exercises/utils";
import { ConvexError } from "convex/values";
import {
  getAll,
  getManyFrom,
  getOneFrom,
} from "convex-helpers/server/relationships";

type SnbtMutationCtx = Pick<MutationCtx, "db">;
type TryoutScoreTotals = Pick<
  Doc<"snbtTryoutAttempts">,
  "totalCorrect" | "totalQuestions"
>;

const HOURS_PER_DAY = 24;
const MINUTES_PER_HOUR = 60;
const SECONDS_PER_MINUTE = 60;
const MILLISECONDS_PER_SECOND = 1000;
const SIMULATION_SECONDS_PER_QUESTION = 90;

const SNBT_TRYOUT_WINDOW_MS =
  HOURS_PER_DAY *
  MINUTES_PER_HOUR *
  SECONDS_PER_MINUTE *
  MILLISECONDS_PER_SECOND;

/**
 * Compute the absolute expiry timestamp for a try-out attempt.
 */
export function computeSnbtTryoutExpiresAtMs(startedAtMs: number) {
  return startedAtMs + SNBT_TRYOUT_WINDOW_MS;
}

/**
 * Resolve the authoritative subject timer for an SNBT subject attempt.
 *
 * Simulation mode is fixed to 90 seconds per question so leaderboard attempts
 * cannot be manipulated by client-provided timing.
 */
export function resolveSnbtSubjectTimeLimitSeconds({
  mode,
  questionCount,
  requestedTimeLimit,
}: {
  mode: Doc<"snbtTryoutAttempts">["mode"];
  questionCount: Doc<"exerciseSets">["questionCount"];
  requestedTimeLimit?: Doc<"exerciseAttempts">["timeLimit"];
}) {
  if (mode === "simulation") {
    return questionCount * SIMULATION_SECONDS_PER_QUESTION;
  }

  if (!requestedTimeLimit || requestedTimeLimit <= 0) {
    throw new ConvexError({
      code: "INVALID_ARGUMENT",
      message: "timeLimit must be greater than 0 for practice mode.",
    });
  }

  return requestedTimeLimit;
}

/**
 * Convert try-out score totals to a percentage.
 */
export function computeSnbtRawScorePercentage({
  totalCorrect,
  totalQuestions,
}: TryoutScoreTotals) {
  if (totalQuestions <= 0) {
    return 0;
  }

  return (totalCorrect / totalQuestions) * 100;
}

/**
 * Count correct answers in a subject attempt.
 */
export function countCorrectAnswers(answers: Doc<"exerciseAnswers">[]) {
  return answers.reduce(
    (correctCount, answer) => correctCount + (answer.isCorrect ? 1 : 0),
    0
  );
}

/**
 * Build IRT response payloads from recorded exercise answers and item
 * parameters.
 */
export function buildIrtResponses({
  answers,
  itemParamsRecords,
}: {
  answers: Doc<"exerciseAnswers">[];
  itemParamsRecords: Doc<"exerciseItemParameters">[];
}) {
  const itemParamsMap = new Map(
    itemParamsRecords.map((itemParams) => [itemParams.questionId, itemParams])
  );

  return answers.flatMap((answer) => {
    if (answer.questionId === undefined) {
      return [];
    }

    const params = itemParamsMap.get(answer.questionId);

    if (!params) {
      return [];
    }

    const response = {
      correct: answer.isCorrect,
      params: {
        difficulty: params.difficulty,
        discrimination: params.discrimination,
        guessing: params.guessing,
      },
    };

    return [response];
  });
}

/**
 * Expire a single shared `exerciseAttempt` if it is still open.
 */
async function expireExerciseAttemptIfInProgress(
  ctx: SnbtMutationCtx,
  attempt: Doc<"exerciseAttempts">,
  expiredAtMs: number,
  now: number
) {
  if (attempt.status !== "in-progress") {
    return;
  }

  const totalTime = computeAttemptDurationSeconds({
    startedAtMs: attempt.startedAt,
    completedAtMs: expiredAtMs,
  });

  await ctx.db.patch("exerciseAttempts", attempt._id, {
    status: "expired",
    completedAt: expiredAtMs,
    lastActivityAt: now,
    updatedAt: now,
    totalTime,
  });
}

/**
 * Expire a try-out attempt and any still-open subject exercise attempts.
 */
export async function expireTryoutAttempt(
  ctx: SnbtMutationCtx,
  tryoutAttempt: Doc<"snbtTryoutAttempts">,
  now: number
) {
  const expiredAtMs = computeSnbtTryoutExpiresAtMs(tryoutAttempt.startedAt);

  if (tryoutAttempt.status === "in-progress") {
    await ctx.db.patch("snbtTryoutAttempts", tryoutAttempt._id, {
      status: "expired",
      completedAt: expiredAtMs,
      lastActivityAt: now,
    });
  }

  const subjectAttempts = await getManyFrom(
    ctx.db,
    "snbtTryoutSubjectAttempts",
    "tryoutAttemptId_subjectIndex",
    tryoutAttempt._id,
    "tryoutAttemptId"
  );
  const setAttempts = await getAll(
    ctx.db,
    "exerciseAttempts",
    subjectAttempts.map((subjectAttempt) => subjectAttempt.setAttemptId)
  );

  for (const setAttempt of setAttempts) {
    if (!setAttempt) {
      continue;
    }

    await expireExerciseAttemptIfInProgress(ctx, setAttempt, expiredAtMs, now);
  }

  return expiredAtMs;
}

/**
 * Synchronize a try-out attempt with its derived 24h expiry window.
 */
export async function syncTryoutAttemptExpiry(
  ctx: SnbtMutationCtx,
  tryoutAttempt: Doc<"snbtTryoutAttempts">,
  now: number
) {
  const expiredAtMs = computeSnbtTryoutExpiresAtMs(tryoutAttempt.startedAt);

  if (tryoutAttempt.status === "expired") {
    return { expired: true as const, expiredAtMs };
  }

  if (tryoutAttempt.status === "in-progress" && now >= expiredAtMs) {
    await expireTryoutAttempt(ctx, tryoutAttempt, now);
    return { expired: true as const, expiredAtMs };
  }

  return { expired: false as const, expiredAtMs };
}

/**
 * Synchronize an `exerciseAttempt` that belongs to an SNBT subject with its
 * parent try-out expiry.
 */
export async function syncSnbtExerciseAttemptExpiry(
  ctx: SnbtMutationCtx,
  attempt: Doc<"exerciseAttempts">,
  now: number
) {
  if (attempt.origin !== "snbt") {
    return { expired: false as const, expiredAtMs: undefined };
  }

  const subjectAttempt = await getOneFrom(
    ctx.db,
    "snbtTryoutSubjectAttempts",
    "setAttemptId",
    attempt._id
  );

  if (!subjectAttempt) {
    throw new ConvexError({
      code: "INVALID_ATTEMPT_STATE",
      message: "SNBT exercise attempt is missing its subject attempt mapping.",
    });
  }

  const tryoutAttempt = await ctx.db.get(
    "snbtTryoutAttempts",
    subjectAttempt.tryoutAttemptId
  );

  if (!tryoutAttempt) {
    throw new ConvexError({
      code: "INVALID_ATTEMPT_STATE",
      message: "SNBT exercise attempt is missing its parent tryout attempt.",
    });
  }

  const tryoutExpiry = await syncTryoutAttemptExpiry(ctx, tryoutAttempt, now);

  if (!tryoutExpiry.expired) {
    return { expired: false as const, expiredAtMs: tryoutExpiry.expiredAtMs };
  }

  await expireExerciseAttemptIfInProgress(
    ctx,
    attempt,
    tryoutExpiry.expiredAtMs,
    now
  );

  return { expired: true as const, expiredAtMs: tryoutExpiry.expiredAtMs };
}
