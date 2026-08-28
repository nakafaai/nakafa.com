import {
  tryoutCatalogIdentity,
  tryoutPlacementIdentity,
} from "@nakafa/aksara-contracts/tryout/identity";
import type { Doc } from "@repo/backend/convex/_generated/dataModel";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import { releaseFail } from "@repo/backend/convex/contentRelease/error";
import { readTryoutSectionRows } from "@repo/backend/convex/contentRelease/tryout/section";
import { Effect } from "effect";

interface RepairRun {
  readonly questionCount: number;
  readonly sectionIdentity: string;
}

interface SignedPlacement {
  readonly rowHash: string;
  readonly sectionIdentity: string;
}

/** Authenticates every signed source placement selected by the repair runs. */
export const loadRepairPlacements = Effect.fn(
  "tryouts.migration.loadRepairPlacements"
)(function* (ctx: MutationCtx, snapshotId: string, runs: readonly RepairRun[]) {
  const placements = new Map<string, SignedPlacement>();
  for (const run of runs) {
    const storedSection = yield* Effect.promise(() =>
      ctx.db
        .query("tryoutCatalog")
        .withIndex("by_snapshotId_and_identity", (query) =>
          query.eq("snapshotId", snapshotId).eq("identity", run.sectionIdentity)
        )
        .unique()
    );
    if (!storedSection) {
      return yield* releaseFail(
        "CONTENT_RELEASE_INTEGRITY",
        "Try-out history scale repair lost a signed source section."
      );
    }
    const source = yield* readTryoutSectionRows(ctx, snapshotId, storedSection);
    if (
      tryoutCatalogIdentity(source.section.row) !== run.sectionIdentity ||
      source.placements.length !== run.questionCount
    ) {
      return yield* releaseFail(
        "CONTENT_RELEASE_INTEGRITY",
        "Try-out history scale repair changed signed section ownership."
      );
    }
    for (const placement of source.placements) {
      const identity = tryoutPlacementIdentity(placement.row);
      if (placements.has(identity)) {
        return yield* releaseFail(
          "CONTENT_RELEASE_INTEGRITY",
          "Try-out history scale repair found duplicate signed placements."
        );
      }
      placements.set(identity, {
        rowHash: placement.rowHash,
        sectionIdentity: run.sectionIdentity,
      });
    }
  }
  return placements;
});

/** Binds each provisional item to its exact signed row and section run. */
export function matchesRepairPlacements(
  placements: ReadonlyMap<string, SignedPlacement>,
  items: readonly Doc<"irtScaleItems">[],
  runs: readonly Doc<"irtCalibrationRuns">[]
) {
  const sectionByRun = new Map(
    runs.map((run) => [run._id, run.sectionIdentity])
  );
  return (
    placements.size === items.length &&
    new Set(items.map(({ placementIdentity }) => placementIdentity)).size ===
      items.length &&
    items.every((item) => {
      const placement = placements.get(item.placementIdentity);
      return (
        placement?.rowHash === item.placementRowHash &&
        placement.sectionIdentity === sectionByRun.get(item.calibrationRunId)
      );
    })
  );
}
