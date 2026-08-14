import { decodeStoredTryoutRow } from "@nakafa/aksara-contracts/history/decode";
import type { Doc } from "@repo/backend/convex/_generated/dataModel";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import { internalMutation } from "@repo/backend/convex/_generated/server";
import { runConvexProgram } from "@repo/backend/convex/lib/effect";
import {
  RETAINED_TRYOUT_SNAPSHOT_ID,
  TRYOUT_HISTORY_CUTOVER_BATCH_SIZE,
} from "@repo/backend/convex/tryouts/history/cutover/constants";
import {
  loadStoredTryoutSnapshot,
  RETAINED_TRYOUT_CATALOG_ROW_COUNT,
  RETAINED_TRYOUT_PLACEMENT_ROW_COUNT,
} from "@repo/backend/convex/tryouts/history/rows";
import { TryoutRuntimeError } from "@repo/backend/convex/tryouts/runtime/error";
import { v } from "convex/values";
import { Effect } from "effect";

type HistoryRowKind = Doc<"tryoutHistoryRows">["rowKind"];
type HistoricalSourceRow = Doc<"tryoutCatalog"> | Doc<"tryoutPlacements">;

const cutoverBatchResultValidator = v.object({
  changed: v.number(),
  complete: v.boolean(),
  remaining: v.number(),
  total: v.number(),
});

/** Copies one bounded catalog batch after authenticating every old envelope. */
export const copyCatalog = internalMutation({
  args: {},
  returns: cutoverBatchResultValidator,
  handler: (ctx) => runConvexProgram(copyRows(ctx, "catalog")),
});

/** Copies one bounded placement batch after authenticating every old envelope. */
export const copyPlacements = internalMutation({
  args: {},
  returns: cutoverBatchResultValidator,
  handler: (ctx) => runConvexProgram(copyRows(ctx, "placement")),
});

/** Deletes copied catalog rows only after exact target-byte comparison. */
export const drainCatalog = internalMutation({
  args: {},
  returns: cutoverBatchResultValidator,
  handler: (ctx) => runConvexProgram(drainRows(ctx, "catalog")),
});

/** Deletes copied placements only after exact target-byte comparison. */
export const drainPlacements = internalMutation({
  args: {},
  returns: cutoverBatchResultValidator,
  handler: (ctx) => runConvexProgram(drainRows(ctx, "placement")),
});

/** Copies one exact old row family into its isolated history table. */
const copyRows = Effect.fn("tryouts.history.cutover.copyRows")(function* (
  ctx: MutationCtx,
  rowKind: HistoryRowKind
) {
  yield* loadStoredTryoutSnapshot(ctx, RETAINED_TRYOUT_SNAPSHOT_ID);
  const expectedCount = expectedRowCount(rowKind);
  const [historyRows, sourceRows] = yield* Effect.all([
    readHistoryRows(ctx, rowKind, expectedCount + 1),
    readSourceRows(ctx, rowKind, expectedCount + 1),
  ]);
  if (historyRows.length > expectedCount) {
    return yield* cutoverIntegrity(
      `Retained ${rowKind} target exceeds its audited inventory.`
    );
  }
  if (historyRows.length === expectedCount) {
    return {
      changed: 0,
      complete: true,
      remaining: 0,
      total: expectedCount,
    };
  }
  if (sourceRows.length !== expectedCount) {
    return yield* cutoverIntegrity(
      `Historical ${rowKind} source differs from its audited inventory.`
    );
  }
  yield* assertUniqueSourceIndices(sourceRows, rowKind);
  const copiedIndices = new Set(historyRows.map(({ index }) => index));
  const nextRows = sourceRows
    .filter(({ index }) => !copiedIndices.has(index))
    .slice(0, TRYOUT_HISTORY_CUTOVER_BATCH_SIZE);
  if (nextRows.length === 0) {
    return yield* cutoverIntegrity(
      `Retained ${rowKind} copy stopped before its audited inventory completed.`
    );
  }
  for (const source of nextRows) {
    const decoded = yield* authenticateSourceRow(source, rowKind);
    if (decoded.rowKind === "catalog") {
      yield* cutoverPromise(
        `Unable to copy retained catalog row ${source.index}.`,
        () =>
          ctx.db.insert("tryoutHistoryRows", {
            index: source.index,
            rowHash: decoded.record.rowHash,
            rowJson: source.rowJson,
            rowKind: "catalog",
            snapshotId: RETAINED_TRYOUT_SNAPSHOT_ID,
          })
      );
      continue;
    }
    yield* cutoverPromise(
      `Unable to copy retained placement row ${source.index}.`,
      () =>
        ctx.db.insert("tryoutHistoryRows", {
          answerArtifactHash: decoded.record.row.answerArtifactHash,
          index: source.index,
          questionArtifactHash: decoded.record.row.questionArtifactHash,
          rowHash: decoded.record.rowHash,
          rowJson: source.rowJson,
          rowKind: "placement",
          snapshotId: RETAINED_TRYOUT_SNAPSHOT_ID,
        })
    );
  }
  const total = historyRows.length + nextRows.length;
  return {
    changed: nextRows.length,
    complete: total === expectedCount,
    remaining: expectedCount - total,
    total,
  };
});

/** Drains one old source family only when every destination byte is present. */
const drainRows = Effect.fn("tryouts.history.cutover.drainRows")(function* (
  ctx: MutationCtx,
  rowKind: HistoryRowKind
) {
  const expectedCount = expectedRowCount(rowKind);
  const [historyRows, sourceRows] = yield* Effect.all([
    readHistoryRows(ctx, rowKind, expectedCount + 1),
    readSourceRows(ctx, rowKind, expectedCount + 1),
  ]);
  if (historyRows.length !== expectedCount) {
    return yield* cutoverIntegrity(
      `Retained ${rowKind} target is incomplete, so source deletion is blocked.`
    );
  }
  if (sourceRows.length > expectedCount) {
    return yield* cutoverIntegrity(
      `Historical ${rowKind} source exceeds its audited inventory.`
    );
  }
  if (sourceRows.length === 0) {
    return { changed: 0, complete: true, remaining: 0, total: 0 };
  }
  const targetsByIndex = new Map(historyRows.map((row) => [row.index, row]));
  const nextRows = sourceRows.slice(0, TRYOUT_HISTORY_CUTOVER_BATCH_SIZE);
  for (const source of nextRows) {
    const target = targetsByIndex.get(source.index);
    if (
      !target ||
      target.rowHash !== source.rowHash ||
      target.rowJson !== source.rowJson
    ) {
      return yield* cutoverIntegrity(
        `Retained ${rowKind} row ${source.index} differs from its source.`
      );
    }
    yield* authenticateSourceRow(target, rowKind);
    yield* cutoverPromise(
      `Unable to drain historical ${rowKind} row ${source.index}.`,
      () => deleteSourceRow(ctx, source)
    );
  }
  const remaining = sourceRows.length - nextRows.length;
  return {
    changed: nextRows.length,
    complete: remaining === 0,
    remaining,
    total: remaining,
  };
});

/** Loads one historical source family through its exact snapshot index. */
function readSourceRows(
  ctx: MutationCtx,
  rowKind: HistoryRowKind,
  limit: number
) {
  if (rowKind === "catalog") {
    return cutoverPromise("Unable to read historical catalog rows.", () =>
      ctx.db
        .query("tryoutCatalog")
        .withIndex("by_snapshotId_and_index", (index) =>
          index.eq("snapshotId", RETAINED_TRYOUT_SNAPSHOT_ID)
        )
        .take(limit)
    );
  }
  return cutoverPromise("Unable to read historical placement rows.", () =>
    ctx.db
      .query("tryoutPlacements")
      .withIndex("by_snapshotId_and_index", (index) =>
        index.eq("snapshotId", RETAINED_TRYOUT_SNAPSHOT_ID)
      )
      .take(limit)
  );
}

/** Loads the exact isolated target family for idempotent copy or drain. */
function readHistoryRows(
  ctx: MutationCtx,
  rowKind: HistoryRowKind,
  limit: number
) {
  return cutoverPromise(`Unable to read retained ${rowKind} rows.`, () =>
    ctx.db
      .query("tryoutHistoryRows")
      .withIndex("by_snapshotId_and_rowKind_and_index", (index) =>
        index
          .eq("snapshotId", RETAINED_TRYOUT_SNAPSHOT_ID)
          .eq("rowKind", rowKind)
      )
      .take(limit)
  );
}

/** Authenticates one old envelope and binds it to indexed storage facts. */
const authenticateSourceRow = Effect.fn(
  "tryouts.history.cutover.authenticateSourceRow"
)(function* (
  source: Pick<HistoricalSourceRow, "rowHash" | "rowJson" | "snapshotId">,
  rowKind: HistoryRowKind
) {
  if (source.snapshotId !== RETAINED_TRYOUT_SNAPSHOT_ID) {
    return yield* cutoverIntegrity(
      `Historical ${rowKind} row changed its snapshot identity.`
    );
  }
  const input = yield* parseRowJson(source.rowJson, rowKind);
  const decoded = yield* decodeStoredTryoutRow(input).pipe(
    Effect.mapError((cause) =>
      cutoverIntegrity(
        `Historical ${rowKind} row failed authentication.`,
        cause
      )
    )
  );
  if (
    decoded.rowKind !== rowKind ||
    decoded.record.rowHash !== source.rowHash
  ) {
    return yield* cutoverIntegrity(
      `Historical ${rowKind} row differs from its indexed identity.`
    );
  }
  return decoded;
});

/** Rejects duplicate storage indices before any history row is copied. */
const assertUniqueSourceIndices = Effect.fn(
  "tryouts.history.cutover.assertUniqueSourceIndices"
)(function* (rows: readonly HistoricalSourceRow[], rowKind: HistoryRowKind) {
  const indices = new Set(rows.map(({ index }) => index));
  if (indices.size !== rows.length) {
    return yield* cutoverIntegrity(
      `Historical ${rowKind} source repeats an audited index.`
    );
  }
});

/** Parses one old row without exposing retained content in errors. */
function parseRowJson(source: string, rowKind: HistoryRowKind) {
  return Effect.try({
    catch: (cause) =>
      cutoverIntegrity(`Historical ${rowKind} row is not valid JSON.`, cause),
    try: (): unknown => JSON.parse(source),
  });
}

/** Deletes one union member through its owning source table. */
function deleteSourceRow(ctx: MutationCtx, row: HistoricalSourceRow) {
  return ctx.db.delete(row._id);
}

/** Returns the one audited row count owned by each history family. */
function expectedRowCount(rowKind: HistoryRowKind) {
  return rowKind === "catalog"
    ? RETAINED_TRYOUT_CATALOG_ROW_COUNT
    : RETAINED_TRYOUT_PLACEMENT_ROW_COUNT;
}

/** Creates one stable fail-closed cutover integrity error. */
function cutoverIntegrity(message: string, cause?: unknown) {
  return new TryoutRuntimeError({
    cause,
    code: "TRYOUT_HISTORY_CUTOVER_INTEGRITY",
    message,
  });
}

/** Lifts one bounded database operation into the cutover error channel. */
function cutoverPromise<A>(message: string, operation: () => Promise<A>) {
  return Effect.tryPromise({
    catch: (cause) => cutoverIntegrity(message, cause),
    try: operation,
  });
}
