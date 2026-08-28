import type { Doc } from "@repo/backend/convex/_generated/dataModel";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import { releaseFail } from "@repo/backend/convex/contentRelease/error";
import { Effect } from "effect";

const MAX_UNUSED_SCALES = 1;
const MAX_UNUSED_RUNS = 32;
const MAX_UNUSED_ITEMS = 512;

type CleanupMigration = Pick<
  Extract<
    Doc<"tryoutHistoryMigrations">,
    { readonly phase: "cleaning" | "completed" }
  >,
  "authorization" | "sourceSnapshotId"
>;

/** Removes the bounded zero-use provisional graph omitted by attempt inventory. */
export const repairUnusedScale = Effect.fn(
  "tryouts.migration.repairUnusedScale"
)(function* (ctx: MutationCtx, migration: CleanupMigration) {
  const authorized = new Set(migration.authorization.sourceScaleVersionIds);
  const scales = yield* Effect.promise(() =>
    ctx.db
      .query("irtScaleVersions")
      .withIndex(
        "by_tryoutSnapshotId_and_setIdentity_and_publishedAt",
        (query) => query.eq("tryoutSnapshotId", migration.sourceSnapshotId)
      )
      .take(authorized.size + MAX_UNUSED_SCALES + 1)
  );
  const unused = scales.filter(({ _id }) => !authorized.has(_id));
  if (unused.length === 0) {
    return false;
  }
  if (unused.length !== MAX_UNUSED_SCALES) {
    return yield* releaseFail(
      "CONTENT_RELEASE_INTEGRITY",
      "Retained cleanup found an unexpected provisional scale inventory."
    );
  }
  const [scale] = unused;
  if (scale === undefined) {
    return yield* releaseFail(
      "CONTENT_RELEASE_INTEGRITY",
      "Retained cleanup lost its provisional scale identity."
    );
  }
  if (scale.status !== "provisional" || scale.history === true) {
    return false;
  }
  const { attempt, items, runs, score } = yield* Effect.all({
    attempt: Effect.promise(() =>
      ctx.db
        .query("tryoutAttempts")
        .withIndex("by_scaleVersionId", (query) =>
          query.eq("scaleVersionId", scale._id)
        )
        .first()
    ),
    items: Effect.promise(() =>
      ctx.db
        .query("irtScaleItems")
        .withIndex("by_scaleVersionId_and_placementIdentity", (query) =>
          query.eq("scaleVersionId", scale._id)
        )
        .take(MAX_UNUSED_ITEMS + 1)
    ),
    runs: Effect.promise(() =>
      ctx.db
        .query("irtCalibrationRuns")
        .withIndex(
          "by_scaleVersionId_and_sectionIdentity_and_startedAt",
          (query) => query.eq("scaleVersionId", scale._id)
        )
        .take(MAX_UNUSED_RUNS + 1)
    ),
    score: Effect.promise(() =>
      ctx.db
        .query("tryoutScores")
        .withIndex("by_scaleVersionId", (query) =>
          query.eq("scaleVersionId", scale._id)
        )
        .first()
    ),
  });
  const runQuestionCount = runs.reduce(
    (count, run) => count + run.questionCount,
    0
  );
  const sectionCount = new Set(
    runs.map(({ sectionIdentity }) => sectionIdentity)
  ).size;
  const runIds = new Set(runs.map(({ _id }) => _id));
  const placementCount = new Set(
    items.map(({ placementIdentity }) => placementIdentity)
  ).size;
  const rowHashCount = new Set(
    items.map(({ placementRowHash }) => placementRowHash)
  ).size;
  if (
    scale.model !== "2pl" ||
    !Number.isSafeInteger(scale.questionCount) ||
    scale.questionCount <= 0 ||
    scale.questionCount > MAX_UNUSED_ITEMS ||
    !Number.isSafeInteger(scale.publishedAt) ||
    scale.publishedAt <= 0 ||
    attempt !== null ||
    score !== null ||
    items.length !== scale.questionCount ||
    placementCount !== items.length ||
    rowHashCount !== items.length ||
    runs.length === 0 ||
    runs.length > MAX_UNUSED_RUNS ||
    sectionCount !== runs.length ||
    !Number.isSafeInteger(runQuestionCount) ||
    runQuestionCount !== scale.questionCount ||
    runs.some(
      (run) =>
        run.model !== scale.model ||
        run.status !== "completed" ||
        run.attemptCount !== 0 ||
        run.responseCount !== 0 ||
        run.iterationCount !== 0 ||
        run.maxParameterDelta !== 0 ||
        run.startedAt !== scale.publishedAt ||
        run.completedAt !== scale.publishedAt ||
        run.updatedAt !== scale.publishedAt ||
        !Number.isSafeInteger(run.questionCount) ||
        run.questionCount <= 0
    ) ||
    items.some(
      (item) =>
        !runIds.has(item.calibrationRunId) ||
        item.calibrationStatus !== "provisional" ||
        item.responseCount !== 0 ||
        item.correctRate !== 0 ||
        item.difficulty !== 0 ||
        item.discrimination !== 1
    ) ||
    runs.some(
      (run) =>
        items.filter(({ calibrationRunId }) => calibrationRunId === run._id)
          .length !== run.questionCount
    )
  ) {
    return yield* releaseFail(
      "CONTENT_RELEASE_INTEGRITY",
      "Retained cleanup cannot prove the unused provisional scale graph."
    );
  }
  yield* Effect.forEach(items, (item) =>
    Effect.promise(() => ctx.db.delete("irtScaleItems", item._id))
  );
  yield* Effect.forEach(runs, (run) =>
    Effect.promise(() => ctx.db.delete("irtCalibrationRuns", run._id))
  );
  yield* Effect.promise(() => ctx.db.delete("irtScaleVersions", scale._id));
  return true;
});
