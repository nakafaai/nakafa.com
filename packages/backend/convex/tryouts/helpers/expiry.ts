import type { Doc } from "@repo/backend/convex/_generated/dataModel";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import { syncTryoutAttemptAggregates } from "@repo/backend/convex/tryouts/helpers/finalize/aggregates";
import { finalizeTryoutPartAttempt } from "@repo/backend/convex/tryouts/helpers/finalize/part";
import { getTryoutScoreTarget } from "@repo/backend/convex/tryouts/helpers/irt";
import { loadBoundedTryoutPartAttempts } from "@repo/backend/convex/tryouts/helpers/loaders";
import { ConvexError } from "convex/values";
import { getOneFrom } from "convex-helpers/server/relationships";

/** Expire a tryout and every still-open shared set attempt under it. */
export async function expireTryoutAttempt(
  ctx: Pick<MutationCtx, "db" | "scheduler">,
  tryoutAttempt: Doc<"tryoutAttempts">,
  now: number
) {
  const expiredAtMs = tryoutAttempt.expiresAt;
  const [scoreTarget, tryout] = await Promise.all([
    getTryoutScoreTarget(ctx.db, tryoutAttempt),
    ctx.db.get("tryouts", tryoutAttempt.tryoutId),
  ]);

  if (!tryout) {
    throw new ConvexError({
      code: "TRYOUT_NOT_FOUND",
      message: "Tryout not found.",
    });
  }

  const partAttempts = await loadBoundedTryoutPartAttempts(ctx.db, {
    partCount: tryout.partCount,
    tryoutAttemptId: tryoutAttempt._id,
  });

  for (const partAttempt of partAttempts) {
    if (tryoutAttempt.completedPartIndices.includes(partAttempt.partIndex)) {
      continue;
    }

    await finalizeTryoutPartAttempt({
      ctx,
      finishedAtMs: expiredAtMs,
      now,
      partAttempt,
      status: "expired",
      tryoutAttemptId: tryoutAttempt._id,
    });
  }

  await syncTryoutAttemptAggregates({
    completedAtMs: expiredAtMs,
    ctx,
    now,
    scaleVersionId: scoreTarget.scaleVersionId,
    scoreStatus: scoreTarget.scoreStatus,
    status: "expired",
    tryoutAttemptId: tryoutAttempt._id,
  });

  return expiredAtMs;
}

/** Reconcile one tryout attempt against its derived expiry window. */
export async function syncTryoutAttemptExpiry(
  ctx: Pick<MutationCtx, "db" | "scheduler">,
  tryoutAttempt: Doc<"tryoutAttempts">,
  now: number
) {
  const expiredAtMs = tryoutAttempt.expiresAt;

  if (tryoutAttempt.status === "expired") {
    return { expired: true, expiredAtMs };
  }

  if (tryoutAttempt.status === "in-progress" && now >= expiredAtMs) {
    await expireTryoutAttempt(ctx, tryoutAttempt, now);
    return { expired: true, expiredAtMs };
  }

  return { expired: false, expiredAtMs };
}

/** Reconcile a shared exercise attempt that belongs to a tryout part. */
export async function syncTryoutExerciseAttemptExpiry(
  ctx: Pick<MutationCtx, "db" | "scheduler">,
  attempt: Doc<"exerciseAttempts">,
  now: number
) {
  if (attempt.origin !== "tryout") {
    return { expired: false, expiredAtMs: undefined };
  }

  const partAttempt = await getOneFrom(
    ctx.db,
    "tryoutPartAttempts",
    "by_setAttemptId",
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

  return {
    expired: tryoutExpiry.expired,
    expiredAtMs: tryoutExpiry.expiredAtMs,
  };
}
