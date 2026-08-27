import type { TryoutHistoryMigrationScaleInventory } from "@nakafa/aksara-contracts/migration/tryout/history/spec";
import type { Doc, Id } from "@repo/backend/convex/_generated/dataModel";
import type {
  MutationCtx,
  QueryCtx,
} from "@repo/backend/convex/_generated/server";
import { hashText } from "@repo/backend/convex/contentRelease/digest";
import { releaseFail } from "@repo/backend/convex/contentRelease/error";
import { retainedTryoutHistoryPlan } from "@repo/backend/convex/tryouts/history/spec";
import { Effect } from "effect";

type ReadCtx = MutationCtx | QueryCtx;

/** Private digest domain shared by source authorization and migration runs. */
export const TRYOUT_HISTORY_SCALE_INVENTORY_DOMAIN =
  "nakafa.tryout-history.scale-inventory";

/** Complete source IRT graph used for exact cloning and reuse checks. */
export interface TryoutHistoryScaleGraph {
  readonly items: readonly Doc<"irtScaleItems">[];
  readonly runs: readonly Doc<"irtCalibrationRuns">[];
  readonly scale: Doc<"irtScaleVersions">;
}

/** Sorts Convex identities before they enter a deterministic private digest. */
function byId(left: { readonly _id: string }, right: { readonly _id: string }) {
  return left._id.localeCompare(right._id);
}

/** Reads the immutable source scale identities selected by retained markers. */
export const readRetainedScaleVersionIds = Effect.fn(
  "tryouts.migration.readRetainedScaleVersionIds"
)(function* (ctx: ReadCtx) {
  const markers = yield* Effect.promise(() =>
    ctx.db
      .query("tryoutAttemptHistory")
      .take(retainedTryoutHistoryPlan.attemptCount + 1)
  );
  const scaleIds = new Set<Id<"irtScaleVersions">>();
  for (const marker of markers) {
    const attempt = yield* Effect.promise(() =>
      ctx.db.get(marker.tryoutAttemptId)
    );
    if (!attempt) {
      return yield* releaseFail(
        "CONTENT_RELEASE_INTEGRITY",
        "Retained scale inventory lost an attempt."
      );
    }
    if (attempt.scaleVersionId) {
      scaleIds.add(attempt.scaleVersionId);
    }
  }
  return [...scaleIds].sort((left, right) => left.localeCompare(right));
});

/** Reads one bounded IRT graph and checks its internal foreign-key closure. */
export const readTryoutHistoryScaleGraph = Effect.fn(
  "tryouts.migration.readScaleGraph"
)(function* (
  ctx: ReadCtx,
  scaleVersionId: Id<"irtScaleVersions">,
  expectedSnapshotId: string
) {
  const scale = yield* Effect.promise(() => ctx.db.get(scaleVersionId));
  if (!scale || scale.tryoutSnapshotId !== expectedSnapshotId) {
    return yield* releaseFail(
      "CONTENT_RELEASE_INTEGRITY",
      "Retained IRT scale changed its snapshot identity."
    );
  }
  if (
    !Number.isSafeInteger(scale.questionCount) ||
    scale.questionCount <= 0 ||
    scale.questionCount > retainedTryoutHistoryPlan.placementRowCount
  ) {
    return yield* releaseFail(
      "CONTENT_RELEASE_INTEGRITY",
      "Retained IRT scale declared an invalid question bound."
    );
  }
  const [runs, items] = yield* Effect.all([
    Effect.promise(() =>
      ctx.db
        .query("irtCalibrationRuns")
        .withIndex(
          "by_scaleVersionId_and_sectionIdentity_and_startedAt",
          (query) => query.eq("scaleVersionId", scale._id)
        )
        .take(scale.questionCount + 1)
    ),
    Effect.promise(() =>
      ctx.db
        .query("irtScaleItems")
        .withIndex("by_scaleVersionId_and_placementIdentity", (query) =>
          query.eq("scaleVersionId", scale._id)
        )
        .take(scale.questionCount + 1)
    ),
  ]);
  if (
    items.length !== scale.questionCount ||
    runs.length > scale.questionCount
  ) {
    return yield* releaseFail(
      "CONTENT_RELEASE_INTEGRITY",
      "Retained IRT scale graph exceeds its complete bounded inventory."
    );
  }
  const runIds = new Set(runs.map(({ _id }) => _id));
  if (items.some(({ calibrationRunId }) => !runIds.has(calibrationRunId))) {
    return yield* releaseFail(
      "CONTENT_RELEASE_INTEGRITY",
      "Retained IRT scale item lost its calibration run."
    );
  }
  return {
    items: items.sort(byId),
    runs: runs.sort(byId),
    scale,
  } satisfies TryoutHistoryScaleGraph;
});

/** Reads exact source graphs and reproduces their signed private inventory. */
export const readTryoutHistoryScaleInventory = Effect.fn(
  "tryouts.migration.readScaleInventory"
)(function* (
  ctx: ReadCtx,
  exactScaleVersionIds?: readonly Id<"irtScaleVersions">[]
) {
  const scaleVersionIds = exactScaleVersionIds
    ? [...exactScaleVersionIds]
    : yield* readRetainedScaleVersionIds(ctx);
  if (
    scaleVersionIds.length > retainedTryoutHistoryPlan.scaleVersionCount ||
    new Set(scaleVersionIds).size !== scaleVersionIds.length ||
    scaleVersionIds.some((id, index) => {
      const previous = scaleVersionIds[index - 1];
      return previous !== undefined && previous.localeCompare(id) >= 0;
    })
  ) {
    return yield* releaseFail(
      "CONTENT_RELEASE_INTEGRITY",
      "Retained IRT scale identities are not unique and ordered."
    );
  }
  const graphs = yield* Effect.forEach(scaleVersionIds, (scaleVersionId) =>
    readTryoutHistoryScaleGraph(
      ctx,
      scaleVersionId,
      retainedTryoutHistoryPlan.snapshotId
    )
  );
  const itemCount = graphs.reduce(
    (count, graph) => count + graph.items.length,
    0
  );
  const runCount = graphs.reduce(
    (count, graph) => count + graph.runs.length,
    0
  );
  return {
    count: graphs.length,
    graphs,
    inventoryJson: JSON.stringify({ graphs, itemCount, runCount }),
    itemCount,
    runCount,
    scaleVersionIds,
  };
});

/** Rechecks every exact source graph against the active-key signed plan. */
export const verifyTryoutHistoryScaleInventory = Effect.fn(
  "tryouts.migration.verifyScaleInventory"
)(function* (
  ctx: ReadCtx,
  scaleVersionIds: readonly Id<"irtScaleVersions">[],
  expected: TryoutHistoryMigrationScaleInventory
) {
  const inventory = yield* readTryoutHistoryScaleInventory(
    ctx,
    scaleVersionIds
  );
  const digest = yield* hashText(
    "retained try-out scale inventory",
    `${TRYOUT_HISTORY_SCALE_INVENTORY_DOMAIN}\n${inventory.inventoryJson}`
  );
  if (
    digest !== expected.digest ||
    inventory.count !== expected.versionCount ||
    inventory.itemCount !== expected.itemCount ||
    inventory.runCount !== expected.runCount
  ) {
    return yield* releaseFail(
      "CONTENT_RELEASE_INTEGRITY",
      "Retained IRT scale inventory changed after authorization."
    );
  }
  return inventory;
});
