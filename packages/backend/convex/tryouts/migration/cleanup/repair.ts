import type { Doc, Id } from "@repo/backend/convex/_generated/dataModel";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import { releaseFail } from "@repo/backend/convex/contentRelease/error";
import { isSnapshotReferenced } from "@repo/backend/convex/contentRelease/snapshot/retention";
import {
  countScaleRepairRows,
  hasValidScaleRepairEvidence,
  matchesScaleRepair,
  retainedScaleRepair,
  type ScaleRepairEvidence,
} from "@repo/backend/convex/tryouts/migration/cleanup/evidence";
import { verifyRepairPlacements } from "@repo/backend/convex/tryouts/migration/cleanup/placement";
import type { CleanupRepair } from "@repo/backend/convex/tryouts/migration/cleanup/schema";
import { Effect } from "effect";

type CleanupMigration = Pick<
  Extract<
    Doc<"tryoutHistoryMigrations">,
    { readonly phase: "cleaning" | "completed" }
  >,
  "authorization" | "migrationId" | "phase" | "sourceSnapshotId"
>;

type CleanupReceipt = Pick<Doc<"tryoutHistoryMigrationReceipts">, "repair">;

interface ScaleRepairResult {
  readonly deletedRows: number;
  readonly repair: Omit<CleanupRepair, "repairedAt">;
}

interface ScaleRepairPlan extends ScaleRepairResult {
  readonly itemIds: readonly Id<"irtScaleItems">[];
  readonly runIds: readonly Id<"irtCalibrationRuns">[];
  readonly scaleVersionId: Id<"irtScaleVersions">;
}

/** Proves one exact zero-use graph before any repair write is possible. */
export const prepareUnusedScale = Effect.fn(
  "tryouts.migration.prepareUnusedScale"
)(function* (
  ctx: MutationCtx,
  migration: CleanupMigration,
  receipt: CleanupReceipt,
  sourceCatalogRowCount: number,
  sourcePlacementRowCount: number,
  evidence: ScaleRepairEvidence = retainedScaleRepair
) {
  const applies =
    migration.migrationId === evidence.migrationId &&
    migration.authorization.planHash === evidence.planHash &&
    migration.sourceSnapshotId === evidence.sourceSnapshotId;
  if (!applies) {
    if (receipt.repair !== undefined) {
      return yield* releaseFail(
        "CONTENT_RELEASE_INTEGRITY",
        "Try-out history cleanup retained repair evidence for another signed plan."
      );
    }
    return null;
  }
  const deletedRows = countScaleRepairRows(evidence);
  if (
    !(
      hasValidScaleRepairEvidence(evidence) && Number.isSafeInteger(deletedRows)
    )
  ) {
    return yield* releaseFail(
      "CONTENT_RELEASE_INTEGRITY",
      "Try-out history cleanup has invalid repair cardinality."
    );
  }
  if (receipt.repair === undefined && migration.phase !== "completed") {
    return yield* releaseFail(
      "CONTENT_RELEASE_INTEGRITY",
      "Try-out history cleanup cannot repair after signed deletion started."
    );
  }
  const authorized = new Set(migration.authorization.sourceScaleVersionIds);
  const scales = yield* Effect.promise(() =>
    ctx.db
      .query("irtScaleVersions")
      .withIndex(
        "by_tryoutSnapshotId_and_setIdentity_and_publishedAt",
        (query) => query.eq("tryoutSnapshotId", migration.sourceSnapshotId)
      )
      .take(authorized.size + 2)
  );
  const unused = scales.filter(({ _id }) => !authorized.has(_id));
  if (receipt.repair !== undefined) {
    if (
      !matchesScaleRepair(receipt.repair, evidence, deletedRows) ||
      unused.length !== 0
    ) {
      return yield* releaseFail(
        "CONTENT_RELEASE_INTEGRITY",
        "Try-out history cleanup lost its durable provisional scale repair."
      );
    }
    return null;
  }
  const scale = unused[0];
  if (
    scale === undefined ||
    unused.length !== 1 ||
    scale._id !== evidence.scaleVersionId
  ) {
    return yield* releaseFail(
      "CONTENT_RELEASE_INTEGRITY",
      "Try-out history cleanup found an unexpected provisional scale identity."
    );
  }
  const { attempt, items, mappings, runs, score } = yield* Effect.all({
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
        .take(evidence.itemCount + 1)
    ),
    mappings: Effect.promise(() =>
      ctx.db
        .query("tryoutHistoryScaleMigrations")
        .withIndex("by_migrationId_and_oldScaleVersionId", (query) =>
          query.eq("migrationId", migration.migrationId)
        )
        .take(authorized.size + 1)
    ),
    runs: Effect.promise(() =>
      ctx.db
        .query("irtCalibrationRuns")
        .withIndex(
          "by_scaleVersionId_and_sectionIdentity_and_startedAt",
          (query) => query.eq("scaleVersionId", scale._id)
        )
        .take(evidence.runs.length + 1)
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
  const expectedRuns = new Map(
    evidence.runs.map(({ questionCount, sectionIdentity }) => [
      sectionIdentity,
      questionCount,
    ])
  );
  const observedRunIdentities = new Set(
    runs.map(({ sectionIdentity }) => sectionIdentity)
  );
  yield* verifyRepairPlacements(
    ctx,
    migration.sourceSnapshotId,
    sourceCatalogRowCount,
    sourcePlacementRowCount,
    items,
    runs
  );
  const runIds = new Set(runs.map(({ _id }) => _id));
  const itemIds = new Set(items.map(({ _id }) => _id));
  const reverseItems = yield* Effect.forEach(runs, (run) =>
    Effect.promise(() =>
      ctx.db
        .query("irtScaleItems")
        .withIndex("by_calibrationRunId", (query) =>
          query.eq("calibrationRunId", run._id)
        )
        .take(run.questionCount + 1)
    )
  );
  const runQuestionCount = runs.reduce(
    (count, run) => count + run.questionCount,
    0
  );
  if (
    scale.setIdentity !== evidence.setIdentity ||
    scale.publishedAt !== evidence.publishedAt ||
    scale.questionCount !== evidence.questionCount ||
    scale.status !== "provisional" ||
    scale.history === true ||
    scale.model !== "2pl" ||
    attempt !== null ||
    score !== null ||
    items.length !== evidence.itemCount ||
    runs.length !== evidence.runs.length ||
    expectedRuns.size !== runs.length ||
    observedRunIdentities.size !== runs.length ||
    !Number.isSafeInteger(runQuestionCount) ||
    runQuestionCount !== evidence.questionCount ||
    mappings.some(
      (mapping) =>
        mapping.oldScaleVersionId === scale._id ||
        mapping.newScaleVersionId === scale._id
    ) ||
    runs.some(
      (run) =>
        expectedRuns.get(run.sectionIdentity) !== run.questionCount ||
        run.model !== scale.model ||
        run.status !== "completed" ||
        run.attemptCount !== 0 ||
        run.responseCount !== 0 ||
        run.iterationCount !== 0 ||
        run.maxParameterDelta !== 0 ||
        run.startedAt !== scale.publishedAt ||
        run.completedAt !== scale.publishedAt ||
        run.updatedAt !== scale.publishedAt ||
        run.error !== undefined
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
    reverseItems.some(
      (rows, index) =>
        rows.length !== runs[index]?.questionCount ||
        rows.some(({ _id }) => !itemIds.has(_id))
    )
  ) {
    return yield* releaseFail(
      "CONTENT_RELEASE_INTEGRITY",
      "Try-out history cleanup cannot prove the exact provisional scale graph."
    );
  }
  if (
    yield* isSnapshotReferenced(ctx, "tryout", migration.sourceSnapshotId, {
      ignoredMigrationId: migration.migrationId,
      ignoredScaleVersionIds: [
        ...migration.authorization.sourceScaleVersionIds,
        scale._id,
      ],
    })
  ) {
    return yield* releaseFail(
      "CONTENT_RELEASE_STATE",
      "The provisional scale repair source is still protected."
    );
  }
  return {
    deletedRows,
    itemIds: items.map(({ _id }) => _id),
    repair: {
      deletedRows,
      itemCount: evidence.itemCount,
      migrationId: evidence.migrationId,
      planHash: evidence.planHash,
      publishedAt: evidence.publishedAt,
      questionCount: evidence.questionCount,
      runCount: evidence.runs.length,
      runs: evidence.runs.map(({ questionCount, sectionIdentity }) => ({
        questionCount,
        sectionIdentity,
      })),
      scaleVersionId: evidence.scaleVersionId,
      setIdentity: evidence.setIdentity,
      sourceSnapshotId: evidence.sourceSnapshotId,
    },
    runIds: runs.map(({ _id }) => _id),
    scaleVersionId: scale._id,
  } satisfies ScaleRepairPlan;
});

/** Commits one previously proven graph inside the caller's transaction. */
export const commitUnusedScale = Effect.fn(
  "tryouts.migration.commitUnusedScale"
)(function* (ctx: MutationCtx, plan: ScaleRepairPlan) {
  yield* Effect.forEach(plan.itemIds, (id) =>
    Effect.promise(() => ctx.db.delete("irtScaleItems", id))
  );
  yield* Effect.forEach(plan.runIds, (id) =>
    Effect.promise(() => ctx.db.delete("irtCalibrationRuns", id))
  );
  yield* Effect.promise(() =>
    ctx.db.delete("irtScaleVersions", plan.scaleVersionId)
  );
  return {
    deletedRows: plan.deletedRows,
    repair: plan.repair,
  } satisfies ScaleRepairResult;
});
