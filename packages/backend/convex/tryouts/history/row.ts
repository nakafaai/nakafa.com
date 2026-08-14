import type {
  MutationCtx,
  QueryCtx,
} from "@repo/backend/convex/_generated/server";
import { historyRead } from "@repo/backend/convex/tryouts/history/spec";
import { Effect } from "effect";

type ReadCtx = MutationCtx | QueryCtx;

/** Checks only immutable retained history for one artifact reference. */
export const hasRetainedHistoryArtifactReference = Effect.fn(
  "tryouts.history.hasRetainedHistoryArtifactReference"
)(function* (ctx: ReadCtx, artifactHash: string) {
  const [answer, question] = yield* Effect.all([
    historyRead("Unable to read retained answer history references.", () =>
      ctx.db
        .query("tryoutHistoryRows")
        .withIndex("by_answerArtifactHash", (query) =>
          query.eq("answerArtifactHash", artifactHash)
        )
        .first()
    ),
    historyRead("Unable to read retained question history references.", () =>
      ctx.db
        .query("tryoutHistoryRows")
        .withIndex("by_questionArtifactHash", (query) =>
          query.eq("questionArtifactHash", artifactHash)
        )
        .first()
    ),
  ]);
  return answer !== null || question !== null;
});
