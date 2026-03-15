import type { Doc } from "@repo/backend/convex/_generated/dataModel";
import type {
  MutationCtx,
  QueryCtx,
} from "@repo/backend/convex/_generated/server";
import { computeAttemptDurationSeconds } from "@repo/backend/convex/exercises/utils";
import { computeTryoutExpiresAtMs } from "@repo/backend/convex/tryouts/products";
import { ConvexError } from "convex/values";
import {
  getAll,
  getManyFrom,
  getOneFrom,
} from "convex-helpers/server/relationships";

type TryoutMutationCtx = Pick<MutationCtx, "db">;
type TryoutDbReader = QueryCtx["db"];
type TryoutScoreTotals = Pick<
  Doc<"tryoutAttempts">,
  "totalCorrect" | "totalQuestions"
>;

/** Converts accumulated tryout score totals into a percentage. */
export function computeTryoutRawScorePercentage({
  totalCorrect,
  totalQuestions,
}: TryoutScoreTotals) {
  if (totalQuestions <= 0) {
    return 0;
  }

  return (totalCorrect / totalQuestions) * 100;
}

/** Returns the earliest completed simulation attempt for official-result checks. */
export function getFirstCompletedSimulationAttempt(
  db: TryoutDbReader,
  { userId, tryoutId }: Pick<Doc<"tryoutAttempts">, "userId" | "tryoutId">
) {
  return db
    .query("tryoutAttempts")
    .withIndex("userId_tryoutId_status_startedAt", (q) =>
      q.eq("userId", userId).eq("tryoutId", tryoutId).eq("status", "completed")
    )
    .order("asc")
    .first();
}

/** Counts correct answers from the shared exercise-attempt answer rows. */
export function countCorrectAnswers(answers: Doc<"exerciseAnswers">[]) {
  return answers.reduce(
    (correctCount, answer) => correctCount + (answer.isCorrect ? 1 : 0),
    0
  );
}

/** Builds the EAP/IRT response payload from scored answers plus item params. */
export function buildIrtResponses({
  answers,
  itemParamsRecords,
}: {
  answers: Doc<"exerciseAnswers">[];
  itemParamsRecords: Pick<
    Doc<"exerciseItemParameters">,
    "questionId" | "difficulty" | "discrimination"
  >[];
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

    return [
      {
        correct: answer.isCorrect,
        params: {
          difficulty: params.difficulty,
          discrimination: params.discrimination,
        },
      },
    ];
  });
}

async function expireExerciseAttemptIfInProgress(
  ctx: TryoutMutationCtx,
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

/** Expires a tryout and every still-open shared set attempt under it. */
export async function expireTryoutAttempt(
  ctx: TryoutMutationCtx,
  tryoutAttempt: Doc<"tryoutAttempts">,
  now: number
) {
  const tryout = await ctx.db.get("tryouts", tryoutAttempt.tryoutId);

  if (!tryout) {
    throw new ConvexError({
      code: "INVALID_ATTEMPT_STATE",
      message: "Tryout attempt is missing its parent tryout.",
    });
  }

  const expiredAtMs = computeTryoutExpiresAtMs({
    product: tryout.product,
    startedAtMs: tryoutAttempt.startedAt,
  });

  if (tryoutAttempt.status === "in-progress") {
    await ctx.db.patch("tryoutAttempts", tryoutAttempt._id, {
      status: "expired",
      completedAt: expiredAtMs,
      lastActivityAt: now,
    });
  }

  const partAttempts = await getManyFrom(
    ctx.db,
    "tryoutPartAttempts",
    "tryoutAttemptId_partIndex",
    tryoutAttempt._id,
    "tryoutAttemptId"
  );
  const setAttempts = await getAll(
    ctx.db,
    "exerciseAttempts",
    partAttempts.map((partAttempt) => partAttempt.setAttemptId)
  );

  for (const setAttempt of setAttempts) {
    if (!setAttempt) {
      continue;
    }

    await expireExerciseAttemptIfInProgress(ctx, setAttempt, expiredAtMs, now);
  }

  return expiredAtMs;
}

/** Reconciles one tryout attempt against its derived expiry window. */
export async function syncTryoutAttemptExpiry(
  ctx: TryoutMutationCtx,
  tryoutAttempt: Doc<"tryoutAttempts">,
  now: number
) {
  const tryout = await ctx.db.get("tryouts", tryoutAttempt.tryoutId);

  if (!tryout) {
    throw new ConvexError({
      code: "INVALID_ATTEMPT_STATE",
      message: "Tryout attempt is missing its parent tryout.",
    });
  }

  const expiredAtMs = computeTryoutExpiresAtMs({
    product: tryout.product,
    startedAtMs: tryoutAttempt.startedAt,
  });

  if (tryoutAttempt.status === "expired") {
    return { expired: true, expiredAtMs };
  }

  if (tryoutAttempt.status === "in-progress" && now >= expiredAtMs) {
    await expireTryoutAttempt(ctx, tryoutAttempt, now);
    return { expired: true, expiredAtMs };
  }

  return { expired: false, expiredAtMs };
}

/** Reconciles a shared exercise attempt that belongs to a tryout part. */
export async function syncTryoutExerciseAttemptExpiry(
  ctx: TryoutMutationCtx,
  attempt: Doc<"exerciseAttempts">,
  now: number
) {
  if (attempt.origin !== "tryout") {
    return { expired: false, expiredAtMs: undefined };
  }

  const partAttempt = await getOneFrom(
    ctx.db,
    "tryoutPartAttempts",
    "setAttemptId",
    attempt._id
  );

  if (!partAttempt) {
    throw new ConvexError({
      code: "INVALID_ATTEMPT_STATE",
      message: "Tryout exercise attempt is missing its part attempt mapping.",
    });
  }

  const tryoutAttempt = await ctx.db.get(
    "tryoutAttempts",
    partAttempt.tryoutAttemptId
  );

  if (!tryoutAttempt) {
    throw new ConvexError({
      code: "INVALID_ATTEMPT_STATE",
      message: "Tryout exercise attempt is missing its parent tryout attempt.",
    });
  }

  const tryoutExpiry = await syncTryoutAttemptExpiry(ctx, tryoutAttempt, now);

  if (!tryoutExpiry.expired) {
    return { expired: false, expiredAtMs: tryoutExpiry.expiredAtMs };
  }

  await expireExerciseAttemptIfInProgress(
    ctx,
    attempt,
    tryoutExpiry.expiredAtMs,
    now
  );

  return { expired: true, expiredAtMs: tryoutExpiry.expiredAtMs };
}
