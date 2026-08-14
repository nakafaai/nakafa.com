import {
  decodeStoredTryoutRow,
  decodeStoredTryoutSnapshot,
  type StoredTryoutRow,
  verifyStoredTryoutInventory,
} from "@nakafa/aksara-contracts/history/decode";
import type { Doc } from "@repo/backend/convex/_generated/dataModel";
import type { QueryCtx } from "@repo/backend/convex/_generated/server";
import { TryoutRuntimeError } from "@repo/backend/convex/tryouts/runtime/error";
import { Effect, Schema } from "effect";

export const RETAINED_TRYOUT_CATALOG_ROW_COUNT = 54;
export const RETAINED_TRYOUT_PLACEMENT_ROW_COUNT = 840;

type HistoryRowKind = Doc<"tryoutHistoryRows">["rowKind"];

const StoredTryoutSnapshotEnvelopeSchema = Schema.Struct({
  family: Schema.Literal("tryout"),
  manifest: Schema.Unknown,
});

/** Authenticates the exact historical snapshot selected by one attempt. */
export const loadStoredTryoutSnapshot = Effect.fn(
  "tryouts.history.loadStoredSnapshot"
)(function* (ctx: QueryCtx, snapshotId: string) {
  const stored = yield* historyPromise(
    "Unable to read the retained try-out snapshot.",
    () =>
      ctx.db
        .query("contentSnapshots")
        .withIndex("by_family_and_snapshotId", (index) =>
          index.eq("family", "tryout").eq("snapshotId", snapshotId)
        )
        .unique()
  );
  if (!stored || stored.verifiedAt === undefined) {
    return yield* historyIntegrity(
      "Retained try-out snapshot bytes are unavailable."
    );
  }
  const input = yield* parseHistoryJson(
    stored.snapshotJson,
    "Retained try-out snapshot"
  );
  const envelope = yield* Schema.decodeUnknown(
    StoredTryoutSnapshotEnvelopeSchema
  )(input, { onExcessProperty: "error" }).pipe(
    Effect.mapError((cause) =>
      historyIntegrity("Retained try-out snapshot envelope is invalid.", cause)
    )
  );
  const snapshot = yield* decodeStoredTryoutSnapshot(envelope.manifest).pipe(
    Effect.mapError((cause) =>
      historyIntegrity(
        "Retained try-out snapshot authentication failed.",
        cause
      )
    )
  );
  if (snapshot.snapshotId !== snapshotId) {
    return yield* historyIntegrity(
      "Retained try-out snapshot changed its storage identity."
    );
  }
  return snapshot;
});

/** Loads and authenticates the complete audited row family for one snapshot. */
export const loadStoredTryoutRows = Effect.fn("tryouts.history.loadStoredRows")(
  function* (ctx: QueryCtx, snapshotId: string, rowKind: HistoryRowKind) {
    const expectedCount =
      rowKind === "catalog"
        ? RETAINED_TRYOUT_CATALOG_ROW_COUNT
        : RETAINED_TRYOUT_PLACEMENT_ROW_COUNT;
    const stored = yield* historyPromise(
      `Unable to read retained try-out ${rowKind} rows.`,
      () =>
        ctx.db
          .query("tryoutHistoryRows")
          .withIndex("by_snapshotId_and_rowKind_and_index", (index) =>
            index.eq("snapshotId", snapshotId).eq("rowKind", rowKind)
          )
          .take(expectedCount + 1)
    );
    if (stored.length !== expectedCount) {
      return yield* historyIntegrity(
        `Retained try-out ${rowKind} inventory does not match its audited count.`
      );
    }
    const uniqueIndices = new Set(stored.map(({ index }) => index));
    if (uniqueIndices.size !== stored.length) {
      return yield* historyIntegrity(
        `Retained try-out ${rowKind} inventory repeats a source index.`
      );
    }
    return yield* Effect.forEach(stored, (row) => decodeHistoryRow(row));
  }
);

/** Authenticates the complete retained inventory against its signed release. */
export const verifyStoredTryoutHistory = Effect.fn(
  "tryouts.history.verifyStoredInventory"
)(function* (ctx: QueryCtx, expectedSnapshotId: string) {
  const [snapshot, catalog, placements] = yield* Effect.all([
    loadStoredTryoutSnapshot(ctx, expectedSnapshotId),
    loadStoredTryoutRows(ctx, expectedSnapshotId, "catalog"),
    loadStoredTryoutRows(ctx, expectedSnapshotId, "placement"),
  ]);
  return yield* verifyStoredTryoutInventory({
    catalog,
    expectedSnapshotId,
    placements,
    snapshot,
  }).pipe(
    Effect.mapError((cause) =>
      historyIntegrity(
        "Retained try-out inventory authentication failed.",
        cause
      )
    )
  );
});

/** Loads one authenticated retained placement by its attempt-owned row hash. */
export const loadStoredTryoutPlacement = Effect.fn(
  "tryouts.history.loadStoredPlacement"
)(function* (ctx: QueryCtx, snapshotId: string, rowHash: string) {
  const stored = yield* historyPromise(
    "Unable to read one retained try-out placement.",
    () =>
      ctx.db
        .query("tryoutHistoryRows")
        .withIndex("by_snapshotId_and_rowKind_and_rowHash", (index) =>
          index
            .eq("snapshotId", snapshotId)
            .eq("rowKind", "placement")
            .eq("rowHash", rowHash)
        )
        .unique()
  );
  if (!stored) {
    return null;
  }
  const decoded = yield* decodeHistoryRow(stored);
  if (decoded.rowKind !== "placement") {
    return yield* historyIntegrity(
      "Retained try-out placement changed its row kind."
    );
  }
  return decoded.record.row;
});

/** Decodes one exact envelope and checks its indexed storage facts. */
const decodeHistoryRow = Effect.fn("tryouts.history.decodeStoredRow")(
  function* (stored: Doc<"tryoutHistoryRows">) {
    const input = yield* parseHistoryJson(
      stored.rowJson,
      `Retained try-out ${stored.rowKind} row`
    );
    const decoded: StoredTryoutRow = yield* decodeStoredTryoutRow(input).pipe(
      Effect.mapError((cause) =>
        historyIntegrity(
          `Retained try-out ${stored.rowKind} row authentication failed.`,
          cause
        )
      )
    );
    if (
      decoded.rowKind !== stored.rowKind ||
      decoded.record.rowHash !== stored.rowHash
    ) {
      return yield* historyIntegrity(
        `Retained try-out ${stored.rowKind} row changed its storage identity.`
      );
    }
    if (
      stored.rowKind === "placement" &&
      decoded.rowKind === "placement" &&
      (stored.answerArtifactHash !== decoded.record.row.answerArtifactHash ||
        stored.questionArtifactHash !== decoded.record.row.questionArtifactHash)
    ) {
      return yield* historyIntegrity(
        "Retained try-out placement changed its artifact identity."
      );
    }
    return decoded;
  }
);

/** Parses historical JSON without leaking immutable user history bytes. */
function parseHistoryJson(source: string, label: string) {
  return Effect.try({
    catch: (cause) => historyIntegrity(`${label} is not valid JSON.`, cause),
    try: (): unknown => JSON.parse(source),
  });
}

/** Creates one stable fail-closed history integrity error. */
function historyIntegrity(message: string, cause?: unknown) {
  return new TryoutRuntimeError({
    cause,
    code: "TRYOUT_HISTORY_INTEGRITY",
    message,
  });
}

/** Lifts one history read without exposing stored bytes in failure messages. */
function historyPromise<A>(message: string, operation: () => Promise<A>) {
  return Effect.tryPromise({
    catch: (cause) =>
      new TryoutRuntimeError({
        cause,
        code: "TRYOUT_HISTORY_READ_FAILED",
        message,
      }),
    try: operation,
  });
}
