import type { Doc } from "@repo/backend/convex/_generated/dataModel";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import type { VerifiedTryoutSet } from "@repo/backend/convex/contentRelease/tryout/set";
import {
  TryoutStartError,
  toTryoutStartError,
  tryoutStartErrorCode,
} from "@repo/backend/convex/tryouts/start/spec";
import { Effect } from "effect";

/** Selects the exact signed IRT scale frozen into one new attempt. */
export const selectAttemptScale = Effect.fn("tryouts.start.selectAttemptScale")(
  function* (
    ctx: MutationCtx,
    set: Doc<"tryoutSets">,
    source: VerifiedTryoutSet
  ) {
    if (set.scoringStrategy !== "irt") {
      return null;
    }

    const scale = yield* Effect.tryPromise({
      catch: toTryoutStartError,
      try: () =>
        ctx.db
          .query("irtScaleVersions")
          .withIndex(
            "by_tryoutSnapshotId_and_setIdentity_and_publishedAt",
            (query) =>
              query
                .eq("tryoutSnapshotId", source.snapshotId)
                .eq("setIdentity", source.setIdentity)
          )
          .order("desc")
          .first(),
    });
    if (scale?.tryoutSetId === set._id) {
      return scale;
    }

    return yield* new TryoutStartError({
      code: tryoutStartErrorCode.irtScaleRequired,
      message: "Published IRT scale is required for this signed try-out.",
    });
  }
);
