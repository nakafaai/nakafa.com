import type { Doc, Id } from "@repo/backend/convex/_generated/dataModel";
import type {
  MutationCtx,
  QueryCtx,
} from "@repo/backend/convex/_generated/server";
import { releaseFail } from "@repo/backend/convex/contentRelease/error";
import {
  readTryoutHistoryScaleGraph,
  type TryoutHistoryScaleGraph,
} from "@repo/backend/convex/tryouts/migration/scale/inventory";
import { Effect } from "effect";

type ReadCtx = MutationCtx | QueryCtx;

/** Observable counts and target identity from one scale migration. */
export interface ScaleMigrationResult {
  readonly itemCount: number;
  readonly runCount: number;
  readonly scaleVersionCount: number;
  readonly scaleVersionId: Id<"irtScaleVersions">;
}

/** Loads one exact target placement mapping required by a scale item. */
const loadPlacementMapping = Effect.fn(
  "tryouts.migration.loadScalePlacementMapping"
)(function* (
  ctx: ReadCtx,
  migrationId: string,
  oldRowHash: string,
  placementIdentity: string
) {
  const mapping = yield* Effect.promise(() =>
    ctx.db
      .query("tryoutHistoryMigrationMaps")
      .withIndex("by_migrationId_and_kind_and_oldHash", (query) =>
        query
          .eq("migrationId", migrationId)
          .eq("kind", "placement")
          .eq("oldHash", oldRowHash)
      )
      .unique()
  );
  if (!mapping || mapping.identity !== placementIdentity) {
    return yield* releaseFail(
      "CONTENT_RELEASE_INTEGRITY",
      "Retained IRT item lost its converted placement mapping."
    );
  }
  return mapping;
});

/** Projects scale fields whose values must remain identical after cloning. */
function scaleFacts(scale: Doc<"irtScaleVersions">) {
  return JSON.stringify({
    model: scale.model,
    publishedAt: scale.publishedAt,
    questionCount: scale.questionCount,
    setIdentity: scale.setIdentity,
    status: scale.status,
  });
}

/** Projects calibration-run fields whose values must survive cloning. */
function runFacts(run: Doc<"irtCalibrationRuns">) {
  return JSON.stringify({
    attemptCount: run.attemptCount,
    completedAt: run.completedAt,
    error: run.error,
    iterationCount: run.iterationCount,
    maxParameterDelta: run.maxParameterDelta,
    model: run.model,
    questionCount: run.questionCount,
    responseCount: run.responseCount,
    sectionIdentity: run.sectionIdentity,
    startedAt: run.startedAt,
    status: run.status,
    updatedAt: run.updatedAt,
  });
}

/** Projects calibrated item values whose values must survive cloning. */
function itemFacts(item: Doc<"irtScaleItems">) {
  return JSON.stringify({
    calibrationStatus: item.calibrationStatus,
    correctRate: item.correctRate,
    difficulty: item.difficulty,
    discrimination: item.discrimination,
    placementIdentity: item.placementIdentity,
    responseCount: item.responseCount,
  });
}

/** Proves an existing target graph is the exact authorized source clone. */
export const verifyScaleClone = Effect.fn("tryouts.migration.verifyScaleClone")(
  function* (
    ctx: ReadCtx,
    migrationId: string,
    source: TryoutHistoryScaleGraph,
    stored: Doc<"tryoutHistoryScaleMigrations">,
    targetSnapshotId: string
  ) {
    const target = yield* readTryoutHistoryScaleGraph(
      ctx,
      stored.newScaleVersionId,
      targetSnapshotId
    );
    if (
      target.scale.history !== true ||
      scaleFacts(source.scale) !== scaleFacts(target.scale) ||
      stored.runMappings.length !== source.runs.length ||
      target.runs.length !== source.runs.length ||
      target.items.length !== source.items.length
    ) {
      return yield* releaseFail(
        "CONTENT_RELEASE_INTEGRITY",
        "Converted IRT scale differs from its source graph."
      );
    }
    const runMappings = new Map(
      stored.runMappings.map(({ newRunId, oldRunId }) => [oldRunId, newRunId])
    );
    const targetRuns = new Map(target.runs.map((run) => [run._id, run]));
    if (
      runMappings.size !== source.runs.length ||
      new Set(runMappings.values()).size !== target.runs.length ||
      source.runs.some((run) => {
        const targetRunId = runMappings.get(run._id);
        const targetRun = targetRunId && targetRuns.get(targetRunId);
        return !targetRun || runFacts(run) !== runFacts(targetRun);
      })
    ) {
      return yield* releaseFail(
        "CONTENT_RELEASE_INTEGRITY",
        "Converted IRT calibration runs differ from their source graph."
      );
    }
    const targetItems = new Map(
      target.items.map((item) => [item.placementIdentity, item])
    );
    if (targetItems.size !== target.items.length) {
      return yield* releaseFail(
        "CONTENT_RELEASE_INTEGRITY",
        "Converted IRT scale repeats a placement identity."
      );
    }
    yield* Effect.forEach(source.items, (item) =>
      Effect.gen(function* () {
        const placement = yield* loadPlacementMapping(
          ctx,
          migrationId,
          item.placementRowHash,
          item.placementIdentity
        );
        const targetItem = targetItems.get(item.placementIdentity);
        if (
          !targetItem ||
          targetItem.placementRowHash !== placement.newHash ||
          targetItem.calibrationRunId !==
            runMappings.get(item.calibrationRunId) ||
          itemFacts(targetItem) !== itemFacts(item)
        ) {
          return yield* releaseFail(
            "CONTENT_RELEASE_INTEGRITY",
            "Converted IRT item differs from its source graph."
          );
        }
      })
    );
    return {
      itemCount: 0,
      runCount: 0,
      scaleVersionCount: 0,
      scaleVersionId: target.scale._id,
    } satisfies ScaleMigrationResult;
  }
);

/** Creates one exact target graph and its explicit calibration-run mapping. */
export const createScaleClone = Effect.fn("tryouts.migration.createScaleClone")(
  function* (
    ctx: MutationCtx,
    migrationId: string,
    source: TryoutHistoryScaleGraph,
    targetSnapshotId: string
  ) {
    const scaleVersionId = yield* Effect.promise(() =>
      ctx.db.insert("irtScaleVersions", {
        history: true,
        model: source.scale.model,
        publishedAt: source.scale.publishedAt,
        questionCount: source.scale.questionCount,
        setIdentity: source.scale.setIdentity,
        status: source.scale.status,
        tryoutSnapshotId: targetSnapshotId,
      })
    );
    const runMappings: {
      newRunId: Id<"irtCalibrationRuns">;
      oldRunId: Id<"irtCalibrationRuns">;
    }[] = [];
    for (const run of source.runs) {
      const newRunId = yield* Effect.promise(() =>
        ctx.db.insert("irtCalibrationRuns", {
          attemptCount: run.attemptCount,
          completedAt: run.completedAt,
          error: run.error,
          iterationCount: run.iterationCount,
          maxParameterDelta: run.maxParameterDelta,
          model: run.model,
          questionCount: run.questionCount,
          responseCount: run.responseCount,
          scaleVersionId,
          sectionIdentity: run.sectionIdentity,
          startedAt: run.startedAt,
          status: run.status,
          updatedAt: run.updatedAt,
        })
      );
      runMappings.push({ newRunId, oldRunId: run._id });
    }
    const newRunIds = new Map(
      runMappings.map(({ newRunId, oldRunId }) => [oldRunId, newRunId])
    );
    for (const item of source.items) {
      const calibrationRunId = newRunIds.get(item.calibrationRunId);
      if (!calibrationRunId) {
        return yield* releaseFail(
          "CONTENT_RELEASE_INTEGRITY",
          "Retained IRT item lost its calibration run."
        );
      }
      const placement = yield* loadPlacementMapping(
        ctx,
        migrationId,
        item.placementRowHash,
        item.placementIdentity
      );
      yield* Effect.promise(() =>
        ctx.db.insert("irtScaleItems", {
          calibrationRunId,
          calibrationStatus: item.calibrationStatus,
          correctRate: item.correctRate,
          difficulty: item.difficulty,
          discrimination: item.discrimination,
          placementIdentity: item.placementIdentity,
          placementRowHash: placement.newHash,
          responseCount: item.responseCount,
          scaleVersionId,
        })
      );
    }
    yield* Effect.promise(() =>
      ctx.db.insert("tryoutHistoryScaleMigrations", {
        migrationId,
        newScaleVersionId: scaleVersionId,
        oldScaleVersionId: source.scale._id,
        runMappings,
      })
    );
    return {
      itemCount: source.items.length,
      runCount: source.runs.length,
      scaleVersionCount: 1,
      scaleVersionId,
    } satisfies ScaleMigrationResult;
  }
);
