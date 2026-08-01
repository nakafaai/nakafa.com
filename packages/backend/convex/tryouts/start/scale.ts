import type { Doc } from "@repo/backend/convex/_generated/dataModel";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import { requireIrtScaleVersion } from "@repo/backend/convex/tryouts/runtime/irt/items";
import type { TryoutStartSource } from "@repo/backend/convex/tryouts/start/source";
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
    source: TryoutStartSource
  ) {
    if (set.scoringStrategy !== "irt") {
      return null;
    }

    if (source.kind === "local") {
      return yield* Effect.tryPromise({
        catch: toTryoutStartError,
        try: () => requireIrtScaleVersion(ctx, { tryoutSetId: set._id }),
      });
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
                .eq("tryoutSnapshotId", source.snapshot.snapshotId)
                .eq("setIdentity", source.snapshot.setIdentity)
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
