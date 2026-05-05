import type { DataModel } from "@repo/backend/convex/_generated/dataModel";
import { captureProductEvent } from "@repo/backend/convex/analytics/capture";
import { computeTryoutRawScorePercentage } from "@repo/backend/convex/tryouts/helpers/metrics";
import type { GenericMutationCtx } from "convex/server";
import type { Change } from "convex-helpers/server/triggers";

/**
 * Captures tryout attempt lifecycle events after start and completion writes.
 */
export async function tryoutAttemptsHandler(
  ctx: GenericMutationCtx<DataModel>,
  change: Change<DataModel, "tryoutAttempts">
) {
  const attempt = change.newDoc;

  if (!attempt) {
    return;
  }

  const tryout = await ctx.db.get(attempt.tryoutId);
  if (!tryout) {
    return;
  }

  if (change.operation === "insert") {
    await captureProductEvent(ctx, {
      distinctId: attempt.userId,
      event: {
        name: "tryout attempt started",
        properties: {
          access_kind: attempt.accessKind,
          attempt_number: attempt.attemptNumber,
          locale: tryout.locale,
          product: tryout.product,
          score_status: attempt.scoreStatus,
          tryout_slug: tryout.slug,
        },
      },
      timestamp: new Date(attempt.startedAt),
    });
    return;
  }

  const oldAttempt = change.oldDoc;
  const completedNow =
    change.operation === "update" &&
    oldAttempt?.status !== "completed" &&
    attempt.status === "completed";

  if (!completedNow) {
    return;
  }

  await captureProductEvent(ctx, {
    distinctId: attempt.userId,
    event: {
      name: "tryout attempt completed",
      properties: {
        attempt_number: attempt.attemptNumber,
        locale: tryout.locale,
        product: tryout.product,
        raw_score_percentage: computeTryoutRawScorePercentage(attempt),
        score_status: attempt.scoreStatus,
        theta: attempt.theta,
        total_correct: attempt.totalCorrect,
        total_questions: attempt.totalQuestions,
        tryout_slug: tryout.slug,
      },
    },
    timestamp:
      attempt.completedAt === null ? undefined : new Date(attempt.completedAt),
  });
}
