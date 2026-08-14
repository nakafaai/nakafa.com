"use node";

import {
  historyFail,
  type RetainedTryoutHistoryPlan,
} from "@repo/backend/convex/tryouts/history/spec";
import {
  type AuthenticatedTerminalBundle,
  authenticateTerminalArtifactPage,
} from "@repo/backend/convex/tryouts/history/terminalBundle";
import type {
  TerminalCatalogRow,
  TerminalHistoryPage,
  TerminalPlacementRow,
  TerminalStoredPlacement,
} from "@repo/backend/convex/tryouts/history/terminalPage";
import type { TerminalHistorySourceService } from "@repo/backend/convex/tryouts/history/terminalSource";
import type {
  TerminalFrozenPage,
  TerminalFrozenPlacement,
} from "@repo/backend/convex/tryouts/history/terminalState";
import { Effect } from "effect";

const PAGE_SIZE = 8;

/** Reads all signed row envelopes while releasing artifact bytes per page. */
export const readAndAuthenticateTerminalHistory = Effect.fn(
  "tryouts.history.readAndAuthenticateTerminalHistory"
)(function* (
  source: TerminalHistorySourceService,
  bundles: readonly AuthenticatedTerminalBundle[],
  plan: RetainedTryoutHistoryPlan
) {
  const catalogRows: TerminalCatalogRow[] = [];
  const placementRows: TerminalStoredPlacement[] = [];
  const artifactHashes = new Set<string>();
  let cursor: null | string = null;
  const maxPages = Math.ceil(
    (plan.catalogRowCount + plan.placementRowCount) / PAGE_SIZE
  );
  for (let pageNumber = 0; pageNumber <= maxPages; pageNumber += 1) {
    const page: TerminalHistoryPage = yield* source.historyPage(cursor);
    const placementPage: TerminalPlacementRow[] = [];
    for (const row of page.rows) {
      if (row.snapshotId !== plan.snapshotId) {
        return yield* historyFail(
          "TRYOUT_HISTORY_INTEGRITY",
          `History row ${row.rowHash} belongs to another snapshot.`
        );
      }
      if (row.rowKind === "catalog") {
        catalogRows.push(row);
        continue;
      }
      placementPage.push(row);
    }
    const hashes = yield* authenticateTerminalArtifactPage(
      placementPage,
      bundles
    );
    for (const hash of hashes) {
      artifactHashes.add(hash);
    }
    for (const row of placementPage) {
      placementRows.push(withoutArtifactJson(row));
    }
    if (
      catalogRows.length > plan.catalogRowCount ||
      placementRows.length > plan.placementRowCount
    ) {
      return yield* historyFail(
        "TRYOUT_HISTORY_INTEGRITY",
        "Terminal history contains rows beyond the accepted inventory."
      );
    }
    if (page.done) {
      return { artifactHashes, catalogRows, placementRows };
    }
    if (page.cursor === cursor || pageNumber === maxPages) {
      return yield* historyFail(
        "TRYOUT_HISTORY_READ_FAILED",
        "Terminal history cursor did not complete within its hard bound."
      );
    }
    cursor = page.cursor;
  }
  return yield* historyFail(
    "TRYOUT_HISTORY_READ_FAILED",
    "Terminal history paging ended without completion."
  );
});

/** Reads all attempt-owned rows under the frozen page hard bound. */
export const readTerminalFrozenRows = Effect.fn(
  "tryouts.history.readTerminalFrozenRows"
)(function* (
  source: TerminalHistorySourceService,
  plan: RetainedTryoutHistoryPlan
) {
  const rows: TerminalFrozenPlacement[] = [];
  let cursor: null | string = null;
  const maxPages = Math.ceil(plan.frozenPlacementCount / PAGE_SIZE);
  for (let pageNumber = 0; pageNumber <= maxPages; pageNumber += 1) {
    const page: TerminalFrozenPage = yield* source.frozenPage(cursor);
    rows.push(...page.rows);
    if (rows.length > plan.frozenPlacementCount) {
      return yield* historyFail(
        "TRYOUT_HISTORY_INTEGRITY",
        "Terminal frozen history exceeds the accepted inventory."
      );
    }
    if (page.done) {
      return rows;
    }
    if (page.cursor === cursor || pageNumber === maxPages) {
      return yield* historyFail(
        "TRYOUT_HISTORY_READ_FAILED",
        "Terminal frozen cursor did not complete within its hard bound."
      );
    }
    cursor = page.cursor;
  }
  return yield* historyFail(
    "TRYOUT_HISTORY_READ_FAILED",
    "Terminal frozen paging ended without completion."
  );
});

function withoutArtifactJson(
  row: TerminalPlacementRow
): TerminalStoredPlacement {
  return {
    answerArtifactHash: row.answerArtifactHash,
    index: row.index,
    questionArtifactHash: row.questionArtifactHash,
    rowHash: row.rowHash,
    rowJson: row.rowJson,
    rowKind: row.rowKind,
    snapshotId: row.snapshotId,
  };
}
