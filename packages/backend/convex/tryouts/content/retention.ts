import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import { Effect } from "effect";

/** Checks frozen question and answer references owned by attempt placements. */
export const hasTryoutArtifactReference = Effect.fn(
  "tryouts.hasArtifactReference"
)(function* (ctx: MutationCtx, artifactHash: string) {
  const [question, answer] = yield* Effect.all([
    Effect.promise(() =>
      ctx.db
        .query("tryoutAttemptPlacements")
        .withIndex("by_questionArtifactHash", (query) =>
          query.eq("questionArtifactHash", artifactHash)
        )
        .first()
    ),
    Effect.promise(() =>
      ctx.db
        .query("tryoutAttemptPlacements")
        .withIndex("by_answerArtifactHash", (query) =>
          query.eq("answerArtifactHash", artifactHash)
        )
        .first()
    ),
  ]);

  return question !== null || answer !== null;
});
