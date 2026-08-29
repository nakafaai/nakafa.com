import type { Doc } from "@repo/backend/convex/_generated/dataModel";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import {
  TryoutRuntimeError,
  tryRuntimePromise,
} from "@repo/backend/convex/tryouts/runtime/error";
import { Effect } from "effect";

const SCALE_CHILD_PAGE_SIZE = 32;
type TryoutAttempt = Doc<"tryoutAttempts">;

/** Deletes one bounded page from an unreferenced attempt-only scale. */
export const cleanupAttemptScale = Effect.fn("tryouts.runtime.cleanupScale")(
  function* (ctx: MutationCtx, attempt: TryoutAttempt) {
    const scaleVersionId = attempt.scaleVersionId;
    if (scaleVersionId === undefined) {
      return false;
    }
    const scale = yield* tryRuntimePromise(() => ctx.db.get(scaleVersionId));
    if (!scale) {
      return yield* new TryoutRuntimeError({
        code: "TRYOUT_HISTORY_SCALE_MISSING",
        message: "A try-out attempt lost its IRT scale.",
      });
    }
    if (scale.history !== true) {
      return false;
    }
    const [attempts, score] = yield* Effect.all([
      tryRuntimePromise(() =>
        ctx.db
          .query("tryoutAttempts")
          .withIndex("by_scaleVersionId", (query) =>
            query.eq("scaleVersionId", scaleVersionId)
          )
          .take(2)
      ),
      tryRuntimePromise(() =>
        ctx.db
          .query("tryoutScores")
          .withIndex("by_scaleVersionId", (query) =>
            query.eq("scaleVersionId", scaleVersionId)
          )
          .first()
      ),
    ]);
    if (score !== null || attempts.some(({ _id }) => _id !== attempt._id)) {
      return false;
    }
    const items = yield* tryRuntimePromise(() =>
      ctx.db
        .query("irtScaleItems")
        .withIndex("by_scaleVersionId_and_placementIdentity", (query) =>
          query.eq("scaleVersionId", scaleVersionId)
        )
        .take(SCALE_CHILD_PAGE_SIZE)
    );
    if (items.length > 0) {
      yield* Effect.forEach(items, (item) =>
        tryRuntimePromise(() => ctx.db.delete("irtScaleItems", item._id))
      );
      return true;
    }
    const runs = yield* tryRuntimePromise(() =>
      ctx.db
        .query("irtCalibrationRuns")
        .withIndex(
          "by_scaleVersionId_and_sectionIdentity_and_startedAt",
          (query) => query.eq("scaleVersionId", scaleVersionId)
        )
        .take(SCALE_CHILD_PAGE_SIZE)
    );
    if (runs.length > 0) {
      yield* Effect.forEach(runs, (run) =>
        tryRuntimePromise(() => ctx.db.delete("irtCalibrationRuns", run._id))
      );
      return true;
    }
    yield* tryRuntimePromise(() =>
      ctx.db.patch("tryoutAttempts", attempt._id, {
        scaleVersionId: undefined,
      })
    );
    yield* tryRuntimePromise(() =>
      ctx.db.delete("irtScaleVersions", scaleVersionId)
    );
    return true;
  }
);
