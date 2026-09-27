import type { Docs } from "@repo/backend/confect/_generated/docs";
import {
  DatabaseReader,
  DatabaseWriter,
} from "@repo/backend/confect/_generated/services";
import {
  TryoutRuntimeError,
  toTryoutRuntimeError,
} from "@repo/backend/confect/tryouts/runtime/error";
import { Effect, flow, Option } from "effect";

const SCALE_CHILD_PAGE_SIZE = 32;
type TryoutAttempt = Docs["tryoutAttempts"];

/** Deletes one bounded page from an unreferenced attempt-only scale. */
export const cleanupAttemptScale = Effect.fn("tryouts.runtime.cleanupScale")(
  function* (attempt: TryoutAttempt) {
    const database = yield* DatabaseReader;
    const writer = yield* DatabaseWriter;
    const scaleVersionId = attempt.scaleVersionId;
    if (scaleVersionId === undefined) {
      return false;
    }
    const scale = yield* database
      .table("irtScaleVersions")
      .get(scaleVersionId)
      .pipe(
        Effect.catchTag("GetByIdFailure", () => Effect.succeed(null)),
        Effect.orDie
      );
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
      database
        .table("tryoutAttempts")
        .index("by_scaleVersionId", (query) =>
          query.eq("scaleVersionId", scaleVersionId)
        )
        .take(2)
        .pipe(Effect.orDie),
      database
        .table("tryoutScores")
        .index("by_scaleVersionId", (query) =>
          query.eq("scaleVersionId", scaleVersionId)
        )
        .first()
        .pipe(Effect.map(Option.getOrNull), Effect.orDie),
    ]);
    if (score !== null || attempts.some(({ _id }) => _id !== attempt._id)) {
      return false;
    }
    const items = yield* database
      .table("irtScaleItems")
      .index("by_scaleVersionId_and_placementIdentity", (query) =>
        query.eq("scaleVersionId", scaleVersionId)
      )
      .take(SCALE_CHILD_PAGE_SIZE)
      .pipe(Effect.orDie);
    if (items.length > 0) {
      yield* Effect.forEach(items, (item) =>
        writer.table("irtScaleItems").delete(item._id)
      );
      return true;
    }
    const runs = yield* database
      .table("irtCalibrationRuns")
      .index("by_scaleVersionId_and_sectionIdentity_and_startedAt", (query) =>
        query.eq("scaleVersionId", scaleVersionId)
      )
      .take(SCALE_CHILD_PAGE_SIZE)
      .pipe(Effect.orDie);
    if (runs.length > 0) {
      yield* Effect.forEach(runs, (run) =>
        writer.table("irtCalibrationRuns").delete(run._id)
      );
      return true;
    }
    yield* writer
      .table("tryoutAttempts")
      .patch(attempt._id, {
        scaleVersionId: undefined,
      })
      .pipe(Effect.orDie);
    yield* writer.table("irtScaleVersions").delete(scaleVersionId);
    return true;
  },
  Effect.catchDefect(flow(toTryoutRuntimeError, Effect.fail))
);
