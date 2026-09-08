import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import { cleanupAttemptRuntime } from "@repo/backend/convex/auth/cleanup/tryouts";
import {
  inspectRetirement,
  readCompletedRetirement,
  requireEmptyAttempt,
} from "@repo/backend/convex/retirement/proof";
import { type Plan, requireProof } from "@repo/backend/convex/retirement/spec";
import { writeTryoutSetProgress } from "@repo/backend/convex/tryouts/progress/write";
import { Effect, Option } from "effect";

/** Deletes only the reviewed empty attempt and restores its unchanged predecessor. */
export const retireAttempt = Effect.fn("retirement.retireAttempt")(function* (
  ctx: MutationCtx,
  plan: Plan
) {
  const completed = yield* readCompletedRetirement(ctx, plan);
  if (Option.isSome(completed)) {
    return {
      alreadyRetired: true,
      retiredAttemptId: plan.attempt._id,
      restoredAttemptId: plan.previous._id,
      restoredProgressId: completed.value,
      removedSections: 0,
      removedPlacements: 0,
    };
  }
  yield* inspectRetirement(ctx, plan);
  let removed = false;
  for (let phase = 0; phase < 8; phase += 1) {
    yield* requireEmptyAttempt(ctx, plan);
    yield* cleanupAttemptRuntime(ctx, plan.attempt);
    const remaining = yield* Effect.promise(() =>
      ctx.db.get("tryoutAttempts", plan.attempt._id)
    );
    if (remaining === null) {
      removed = true;
      break;
    }
  }
  yield* requireProof(
    removed,
    "The reviewed cleanup exceeded its atomic phase bound."
  );
  yield* Effect.promise(() =>
    ctx.db.delete("tryoutSetProgress", plan.progress._id)
  );
  const restoredProgressId = yield* writeTryoutSetProgress(ctx, {
    attempt: plan.previous,
    publishedScore: plan.previousScore.publishedScore,
    status: plan.previous.status,
    updatedAt: plan.previous.lastActivityAt,
  });
  return {
    alreadyRetired: false,
    retiredAttemptId: plan.attempt._id,
    restoredAttemptId: plan.previous._id,
    restoredProgressId,
    removedSections: 1,
    removedPlacements: 160,
  };
});
