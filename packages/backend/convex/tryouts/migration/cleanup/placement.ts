import type { StoredTryoutRow } from "@nakafa/aksara-contracts/history/decode";
import type { Doc } from "@repo/backend/convex/_generated/dataModel";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import {
  ReleaseError,
  releaseFail,
} from "@repo/backend/convex/contentRelease/error";
import {
  loadStoredTryoutCatalogRows,
  loadStoredTryoutPlacement,
} from "@repo/backend/convex/tryouts/history/rows";
import { Effect } from "effect";

/** Authenticates every signed source placement selected by the repair runs. */
export const verifyRepairPlacements = Effect.fn(
  "tryouts.migration.verifyRepairPlacements"
)(function* (
  ctx: MutationCtx,
  snapshotId: string,
  catalogRowCount: number,
  items: readonly Doc<"irtScaleItems">[],
  runs: readonly Doc<"irtCalibrationRuns">[]
) {
  const catalog = yield* loadStoredTryoutCatalogRows(
    ctx,
    snapshotId,
    catalogRowCount
  ).pipe(Effect.mapError(repairSourceError));
  const sectionRows = catalog.flatMap(({ record }) =>
    record.row.kind === "section" ? [record.row] : []
  );
  const sections = new Map(
    sectionRows.map((row) => [historicalCatalogIdentity(row), row] as const)
  );
  const runById = new Map(runs.map((run) => [run._id, run]));
  if (sections.size !== sectionRows.length || runById.size !== runs.length) {
    return yield* repairPlacementFailure();
  }
  for (const run of runs) {
    const section = sections.get(run.sectionIdentity);
    if (!section || section.questionCount !== run.questionCount) {
      return yield* repairPlacementFailure();
    }
  }
  const placementIdentities = new Set<string>();
  yield* Effect.forEach(items, (item) =>
    Effect.gen(function* () {
      const placement = yield* loadStoredTryoutPlacement(
        ctx,
        snapshotId,
        item.placementRowHash
      ).pipe(Effect.mapError(repairSourceError));
      if (!placement) {
        return yield* repairPlacementFailure();
      }
      const placementIdentity = historicalPlacementIdentity(placement);
      const run = runById.get(item.calibrationRunId);
      const sectionIdentity = historicalSectionIdentity(placement);
      if (
        !run ||
        placementIdentity !== item.placementIdentity ||
        run.sectionIdentity !== sectionIdentity ||
        placementIdentities.has(placementIdentity)
      ) {
        return yield* repairPlacementFailure();
      }
      placementIdentities.add(placementIdentity);
    })
  );
  if (placementIdentities.size !== items.length) {
    return yield* repairPlacementFailure();
  }
});

type HistoricalCatalogRow = Extract<
  StoredTryoutRow,
  { readonly rowKind: "catalog" }
>["record"]["row"];
type HistoricalPlacement = Extract<
  StoredTryoutRow,
  { readonly rowKind: "placement" }
>["record"]["row"];

/** Reconstructs the ordering identity frozen into the retained catalog. */
function historicalCatalogIdentity(row: HistoricalCatalogRow) {
  return [
    row.locale,
    row.kind,
    row.countryKey,
    "examKey" in row ? row.examKey : "",
    "trackKey" in row ? row.trackKey : "",
    "setKey" in row ? row.setKey : "",
    "sectionKey" in row ? row.sectionKey : "",
  ].join("\0");
}

/** Derives the exact retained section identity for one old placement. */
function historicalSectionIdentity(row: HistoricalPlacement) {
  return [
    row.locale,
    "section",
    row.countryKey,
    row.examKey,
    row.trackKey,
    row.setKey,
    row.sectionKey,
  ].join("\0");
}

/** Reconstructs the placement identity frozen into the old scale graph. */
function historicalPlacementIdentity(row: HistoricalPlacement) {
  return [
    row.countryKey,
    row.examKey,
    row.trackKey,
    row.setKey,
    row.sectionKey,
    row.questionOrder,
    row.questionContentKey,
    row.locale,
  ].join("\0");
}

/** Maps retained-history failures into the signed cleanup boundary. */
function repairSourceError() {
  return new ReleaseError({
    code: "CONTENT_RELEASE_INTEGRITY",
    message: "Try-out history scale repair lost its signed source rows.",
  });
}

/** Fails one mismatch without exposing immutable historical row bytes. */
function repairPlacementFailure() {
  return releaseFail(
    "CONTENT_RELEASE_INTEGRITY",
    "Try-out history scale repair changed signed placement ownership."
  );
}
