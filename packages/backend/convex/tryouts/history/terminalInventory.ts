import { tryoutPlacementIdentity } from "@nakafa/aksara-contracts/tryout/identity";
import { decodeHistoryInventory } from "@repo/backend/convex/tryouts/history/decode";
import type { AuthenticatedHistoryPlacement } from "@repo/backend/convex/tryouts/history/placement";
import {
  historyFail,
  type RetainedTryoutHistoryPlan,
} from "@repo/backend/convex/tryouts/history/spec";
import type {
  TerminalCatalogRow,
  TerminalStoredPlacement,
} from "@repo/backend/convex/tryouts/history/terminalPage";
import { Effect } from "effect";

export interface TerminalAuthenticatedInventory {
  readonly catalogRows: number;
  readonly placementByIdentity: ReadonlyMap<
    string,
    AuthenticatedHistoryPlacement
  >;
  readonly placementRows: number;
}

/** Authenticates exact storage envelopes and both snapshot aggregate digests. */
export const authenticateTerminalInventory = Effect.fn(
  "tryouts.history.authenticateTerminalInventory"
)(function* (
  snapshotJson: string,
  catalogRows: readonly TerminalCatalogRow[],
  placementRows: readonly TerminalStoredPlacement[],
  plan: RetainedTryoutHistoryPlan
) {
  if (
    catalogRows.length !== plan.catalogRowCount ||
    placementRows.length !== plan.placementRowCount
  ) {
    return yield* historyFail(
      "TRYOUT_HISTORY_NOT_READY",
      `Found ${catalogRows.length} catalog and ${placementRows.length} placement rows.`
    );
  }
  const catalog = [...catalogRows].sort(
    (left, right) => left.index - right.index
  );
  const placements = [...placementRows].sort(
    (left, right) => left.index - right.index
  );
  const authenticated = yield* decodeHistoryInventory(
    snapshotJson,
    catalog.map(({ rowJson }) => rowJson),
    placements.map(({ rowJson }) => rowJson),
    plan
  );
  for (const [offset, stored] of catalog.entries()) {
    const signed = authenticated.catalog[offset];
    if (
      !signed ||
      stored.index !== plan.firstCatalogIndex + offset ||
      stored.snapshotId !== plan.snapshotId ||
      stored.rowHash !== signed.record.rowHash
    ) {
      return yield* historyFail(
        "TRYOUT_HISTORY_INTEGRITY",
        `Catalog history row ${stored.index} lost its storage identity.`
      );
    }
  }

  const placementByIdentity = new Map<string, AuthenticatedHistoryPlacement>();
  for (const [offset, stored] of placements.entries()) {
    const signed = authenticated.placements[offset];
    if (
      !signed ||
      stored.index !== plan.firstPlacementIndex + offset ||
      stored.snapshotId !== plan.snapshotId ||
      stored.rowHash !== signed.record.rowHash ||
      stored.answerArtifactHash !== signed.record.row.answerArtifactHash ||
      stored.questionArtifactHash !== signed.record.row.questionArtifactHash
    ) {
      return yield* historyFail(
        "TRYOUT_HISTORY_INTEGRITY",
        `Placement history row ${stored.index} lost its storage identity.`
      );
    }
    const identity = tryoutPlacementIdentity(signed.record.row);
    if (placementByIdentity.has(identity)) {
      return yield* historyFail(
        "TRYOUT_HISTORY_INTEGRITY",
        `Placement history row ${stored.index} repeats ${identity}.`
      );
    }
    placementByIdentity.set(identity, { history: stored, signed });
  }
  return {
    catalogRows: authenticated.catalog.length,
    placementByIdentity,
    placementRows: authenticated.placements.length,
  } satisfies TerminalAuthenticatedInventory;
});
