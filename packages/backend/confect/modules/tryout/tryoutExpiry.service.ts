import type { Doc } from "@repo/backend/confect/_generated/dataModel";
import type { ConvexMutationCtx } from "@repo/backend/confect/modules/shared/convexContext";
import { TryoutError } from "@repo/backend/confect/modules/tryout/tryout.errors";
import { syncTryoutAttemptAggregates } from "@repo/backend/confect/modules/tryout/tryoutFinalizeAggregates.service";
import { finalizeTryoutPartAttempt } from "@repo/backend/confect/modules/tryout/tryoutFinalizePart.service";
import { getTryoutScoreTarget } from "@repo/backend/confect/modules/tryout/tryoutIrt.service";
import { loadBoundedTryoutPartAttempts } from "@repo/backend/confect/modules/tryout/tryoutLoaders.service";
import { Effect } from "effect";

/** Expires a tryout attempt and finalizes every unfinished part. */
export const expireTryoutAttempt = Effect.fn(
  "tryouts.expiry.expireTryoutAttempt"
)(function* (
  ctx: ConvexMutationCtx,
  tryoutAttempt: Doc<"tryoutAttempts">,
  now: number
) {
  const expiredAtMs = tryoutAttempt.expiresAt;
  const scoreTarget = yield* getTryoutScoreTarget(ctx.db, tryoutAttempt);
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

  const partAttempts = yield* loadBoundedTryoutPartAttempts(ctx.db, {
    partCount: tryoutAttempt.partSetSnapshots.length,
    tryoutAttemptId: tryoutAttempt._id,
  });

  for (const partAttempt of partAttempts) {
    if (tryoutAttempt.completedPartIndices.includes(partAttempt.partIndex)) {
      continue;
    }

    yield* finalizeTryoutPartAttempt({
      ctx,
      finishedAtMs: expiredAtMs,
      now,
      partAttempt,
      status: "expired",
      tryoutAttemptId: tryoutAttempt._id,
    });
  }

  yield* syncTryoutAttemptAggregates(ctx, {
    completedAtMs: expiredAtMs,
    now,
    scaleVersionId: scoreTarget.scaleVersionId,
    scoreStatus: scoreTarget.scoreStatus,
    status: "expired",
    tryoutAttemptId: tryoutAttempt._id,
  });

  return expiredAtMs;
});

/** Synchronizes the persisted expired state when the tryout deadline has passed. */
export const syncTryoutAttemptExpiry = Effect.fn(
  "tryouts.expiry.syncTryoutAttemptExpiry"
)(function* (
  ctx: ConvexMutationCtx,
  tryoutAttempt: Doc<"tryoutAttempts">,
  now: number
) {
  const expiredAtMs = tryoutAttempt.expiresAt;

  if (tryoutAttempt.status === "expired") {
    return { expired: true, expiredAtMs };
  }

  if (tryoutAttempt.status === "in-progress" && now >= expiredAtMs) {
    yield* expireTryoutAttempt(ctx, tryoutAttempt, now);
    return { expired: true, expiredAtMs };
  }

  return { expired: false, expiredAtMs };
});

/** Synchronizes tryout expiry for an exercise attempt owned by a tryout part. */
export const syncTryoutExerciseAttemptExpiry = Effect.fn(
  "tryouts.expiry.syncTryoutExerciseAttemptExpiry"
)(function* (
  ctx: ConvexMutationCtx,
  attempt: Doc<"exerciseAttempts">,
  now: number
) {
  if (attempt.origin !== "tryout") {
    return { expired: false, expiredAtMs: undefined };
  }

  const partAttempt = yield* Effect.promise(() =>
    ctx.db
      .query("tryoutPartAttempts")
      .withIndex("by_setAttemptId", (query) =>
        query.eq("setAttemptId", attempt._id)
      )
      .unique()
  );

  if (!partAttempt) {
    return yield* Effect.fail(
      new TryoutError({
        code: "INVALID_ATTEMPT_STATE",
        message: "Tryout exercise attempt is missing its part attempt mapping.",
      })
    );
  }

  const tryoutAttempt = yield* Effect.promise(() =>
    ctx.db.get(partAttempt.tryoutAttemptId)
  );

  if (!tryoutAttempt) {
    return yield* Effect.fail(
      new TryoutError({
        code: "INVALID_ATTEMPT_STATE",
        message:
          "Tryout exercise attempt is missing its parent tryout attempt.",
      })
    );
  }

  return yield* syncTryoutAttemptExpiry(ctx, tryoutAttempt, now);
});
