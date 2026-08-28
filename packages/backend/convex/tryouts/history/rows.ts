import {
  decodeStoredTryoutRow,
  type StoredTryoutRow,
} from "@nakafa/aksara-contracts/history/decode";
import type { Doc } from "@repo/backend/convex/_generated/dataModel";
import type {
  MutationCtx,
  QueryCtx,
} from "@repo/backend/convex/_generated/server";
import { TryoutRuntimeError } from "@repo/backend/convex/tryouts/runtime/error";
import { Effect } from "effect";

export const RETAINED_TRYOUT_CATALOG_ROW_COUNT = 54;
type ReadCtx = MutationCtx | QueryCtx;

/** Loads and authenticates the complete retained catalog for one snapshot. */
export const loadStoredTryoutCatalogRows = Effect.fn(
  "tryouts.history.loadStoredCatalogRows"
)(function* (
  ctx: ReadCtx,
  snapshotId: string,
  expectedCount = RETAINED_TRYOUT_CATALOG_ROW_COUNT
) {
  if (
    !Number.isSafeInteger(expectedCount) ||
    expectedCount <= 0 ||
    expectedCount > RETAINED_TRYOUT_CATALOG_ROW_COUNT
  ) {
    return yield* historyIntegrity(
      "Retained try-out catalog count exceeds its audited bound."
    );
  }
  const stored = yield* historyPromise(
    "Unable to read retained try-out catalog rows.",
    () =>
      ctx.db
        .query("tryoutHistoryRows")
        .withIndex("by_snapshotId_and_rowKind_and_index", (index) =>
          index.eq("snapshotId", snapshotId).eq("rowKind", "catalog")
        )
        .take(expectedCount + 1)
  );
  if (stored.length !== expectedCount) {
    return yield* historyIntegrity(
      "Retained try-out catalog does not match its audited count."
    );
  }
  const uniqueIndices = new Set(stored.map(({ index }) => index));
  if (uniqueIndices.size !== stored.length) {
    return yield* historyIntegrity(
      "Retained try-out catalog repeats a source index."
    );
  }
  return yield* Effect.forEach(stored, (row) => decodeCatalogHistoryRow(row));
});

/** Narrows an authenticated retained row to the catalog family. */
const decodeCatalogHistoryRow = Effect.fn(
  "tryouts.history.decodeStoredCatalogRow"
)(function* (stored: Doc<"tryoutHistoryRows">) {
  const decoded = yield* decodeHistoryRow(stored);
  if (decoded.rowKind !== "catalog") {
    return yield* historyIntegrity(
      "Retained try-out catalog changed its row kind."
    );
  }
  return decoded;
});

/** Loads one authenticated retained placement by its attempt-owned row hash. */
export const loadStoredTryoutPlacement = Effect.fn(
  "tryouts.history.loadStoredPlacement"
)(function* (ctx: ReadCtx, snapshotId: string, rowHash: string) {
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
