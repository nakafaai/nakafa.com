import type { Id } from "@repo/backend/confect/_generated/dataModel";
import { MutationCtx } from "@repo/backend/confect/_generated/services";
import { Clock, Effect } from "effect";

/** Publishes a scheduled assessment from the internal scheduler. */
export const publishAssessment = Effect.fn("assessments.publishAssessment")(
  function* (args: {
    readonly assessmentId: Id<"schoolAssessments">;
    readonly publishedBy: Id<"users">;
  }) {
    const ctx = yield* MutationCtx;
    const assessment = yield* Effect.promise(() =>
      ctx.db.get(args.assessmentId)
    );

    if (!assessment || assessment.status !== "scheduled") {
      return null;
    }

    const now = yield* Clock.currentTimeMillis;

    yield* Effect.promise(() =>
      ctx.db.patch(args.assessmentId, {
        publishedAt: now,
        publishedBy: args.publishedBy,
        scheduledAt: undefined,
        scheduledJobId: undefined,
        status: "published",
        updatedAt: now,
        updatedBy: args.publishedBy,
      })
    );

    return null;
  }
);
