import { tryoutPlacementIdentity } from "@nakafa/aksara-contracts/tryout/identity";
import type { Doc } from "@repo/backend/convex/_generated/dataModel";
import type {
  MutationCtx,
  QueryCtx,
} from "@repo/backend/convex/_generated/server";
import {
  decodeHistoryInventory,
  type HistoricalTryoutRow,
} from "@repo/backend/convex/tryouts/history/decode";
import type { RetainedTryoutInventory } from "@repo/backend/convex/tryouts/history/inventory";
import type { AuthenticatedHistoryPlacement } from "@repo/backend/convex/tryouts/history/placement";
import {
  historyFail,
  historyRead,
  type RetainedTryoutHistoryPlan,
} from "@repo/backend/convex/tryouts/history/spec";
import { Effect } from "effect";

type HistoryCatalog = Extract<
  Doc<"tryoutHistoryRows">,
  { readonly rowKind: "catalog" }
>;
type HistoryPlacement = Extract<
  Doc<"tryoutHistoryRows">,
  { readonly rowKind: "placement" }
>;
type SignedCatalog = Extract<
  HistoricalTryoutRow,
  { readonly rowKind: "catalog" }
>;
type SignedPlacement = Extract<
  HistoricalTryoutRow,
  { readonly rowKind: "placement" }
>;
type ReadCtx = MutationCtx | QueryCtx;

export interface AuthenticatedHistoryRows {
  readonly catalogRows: readonly AuthenticatedHistoryCatalog[];
  readonly placementByIdentity: ReadonlyMap<
    string,
    AuthenticatedHistoryPlacement
  >;
  readonly placementRows: readonly AuthenticatedHistoryPlacement[];
}

interface AuthenticatedHistoryCatalog {
  readonly history: HistoryCatalog;
  readonly signed: SignedCatalog;
}

/** Proves one persisted catalog envelope matches its authenticated old row. */
function hasCatalogIdentity(
  history: Doc<"tryoutHistoryRows">,
  signed: SignedCatalog,
  expectedIndex: number,
  snapshotId: string
): history is HistoryCatalog {
  return (
    history.rowKind === "catalog" &&
    history.index === expectedIndex &&
    history.snapshotId === snapshotId &&
    history.rowHash === signed.record.rowHash
  );
}

/** Proves one persisted placement envelope matches its authenticated old row. */
function hasPlacementIdentity(
  history: Doc<"tryoutHistoryRows">,
  signed: SignedPlacement,
  expectedIndex: number,
  snapshotId: string
): history is HistoryPlacement {
  const row = signed.record.row;
  return (
    history.rowKind === "placement" &&
    history.index === expectedIndex &&
    history.snapshotId === snapshotId &&
    history.rowHash === signed.record.rowHash &&
    history.answerArtifactHash === row.answerArtifactHash &&
    history.questionArtifactHash === row.questionArtifactHash
  );
}

/** Authenticates exact history rows without reading mutable source tables. */
export const authenticateRetainedHistoryRows = Effect.fn(
  "tryouts.history.authenticateRetainedHistoryRows"
)(function* (
  ctx: ReadCtx,
  inventory: RetainedTryoutInventory,
  plan: RetainedTryoutHistoryPlan
) {
  const totalRowCount = plan.catalogRowCount + plan.placementRowCount;
  const stored = yield* historyRead(
    "Unable to read exact retained history inventory.",
    () => ctx.db.query("tryoutHistoryRows").take(totalRowCount + 1)
  );
  const storedCatalog: HistoryCatalog[] = [];
  const storedPlacements: HistoryPlacement[] = [];
  for (const row of stored) {
    if (row.snapshotId !== plan.snapshotId) {
      return yield* historyFail(
        "TRYOUT_HISTORY_INTEGRITY",
        `History row ${row._id} belongs to an unexpected snapshot.`
      );
    }
    if (row.rowKind === "catalog") {
      storedCatalog.push(row);
    } else {
      storedPlacements.push(row);
    }
  }
  storedCatalog.sort((left, right) => left.index - right.index);
  storedPlacements.sort((left, right) => left.index - right.index);
  if (
    stored.length !== totalRowCount ||
    storedCatalog.length !== plan.catalogRowCount ||
    storedPlacements.length !== plan.placementRowCount
  ) {
    return yield* historyFail(
      "TRYOUT_HISTORY_NOT_READY",
      `Retained history must contain exactly ${plan.catalogRowCount} catalog and ${plan.placementRowCount} placement rows.`
    );
  }

  const authenticated = yield* decodeHistoryInventory(
    inventory.snapshot.snapshotJson,
    storedCatalog.map(({ rowJson }) => rowJson),
    storedPlacements.map(({ rowJson }) => rowJson),
    plan
  );
  const catalogRows: AuthenticatedHistoryCatalog[] = [];
  for (const [offset, signed] of authenticated.catalog.entries()) {
    const history = storedCatalog[offset];
    const expectedIndex = plan.firstCatalogIndex + offset;
    if (
      !(
        history &&
        hasCatalogIdentity(history, signed, expectedIndex, plan.snapshotId)
      )
    ) {
      return yield* historyFail(
        "TRYOUT_HISTORY_INTEGRITY",
        `Catalog history row ${expectedIndex} has mismatched envelope facts.`
      );
    }
    catalogRows.push({ history, signed });
  }

  const placementRows: AuthenticatedHistoryPlacement[] = [];
  const placementByIdentity = new Map<string, AuthenticatedHistoryPlacement>();
  for (const [offset, signed] of authenticated.placements.entries()) {
    const history = storedPlacements[offset];
    const expectedIndex = plan.firstPlacementIndex + offset;
    if (
      !(
        history &&
        hasPlacementIdentity(history, signed, expectedIndex, plan.snapshotId)
      )
    ) {
      return yield* historyFail(
        "TRYOUT_HISTORY_INTEGRITY",
        `Placement history row ${expectedIndex} has mismatched envelope facts.`
      );
    }
    const identity = tryoutPlacementIdentity(signed.record.row);
    if (placementByIdentity.has(identity)) {
      return yield* historyFail(
        "TRYOUT_HISTORY_INTEGRITY",
        `Placement history row ${expectedIndex} repeats an authenticated identity.`
      );
    }
    const authenticated = { history, signed };
    placementRows.push(authenticated);
    placementByIdentity.set(identity, authenticated);
  }

  return {
    catalogRows,
    placementByIdentity,
    placementRows,
  } satisfies AuthenticatedHistoryRows;
});
