import {
  tryoutCatalogIdentity,
  tryoutPlacementIdentity,
} from "@nakafa/aksara-contracts/tryout/identity";
import type { Doc } from "@repo/backend/convex/_generated/dataModel";
import type {
  MutationCtx,
  QueryCtx,
} from "@repo/backend/convex/_generated/server";
import { ensureDocumentSize } from "@repo/backend/convex/contentRelease/document";
import { decodeHistoryRowJson } from "@repo/backend/convex/tryouts/history/decode";
import {
  historyFail,
  historyIntegrity,
  historyRead,
  historyWrite,
  type RetainedTryoutHistoryPlan,
} from "@repo/backend/convex/tryouts/history/spec";
import type { WithoutSystemFields } from "convex/server";
import { Effect } from "effect";

type HistoryRow = Doc<"tryoutHistoryRows">;
type HistoryValues = WithoutSystemFields<HistoryRow>;
type SourceRow = Doc<"tryoutCatalog"> | Doc<"tryoutPlacements">;
type ReadCtx = MutationCtx | QueryCtx;

/** Checks only immutable retained history for one artifact reference. */
export const hasRetainedHistoryArtifactReference = Effect.fn(
  "tryouts.history.hasRetainedHistoryArtifactReference"
)(function* (ctx: ReadCtx, artifactHash: string) {
  const [answer, question] = yield* Effect.all([
    historyRead("Unable to read retained answer history references.", () =>
      ctx.db
        .query("tryoutHistoryRows")
        .withIndex("by_answerArtifactHash", (query) =>
          query.eq("answerArtifactHash", artifactHash)
        )
        .first()
    ),
    historyRead("Unable to read retained question history references.", () =>
      ctx.db
        .query("tryoutHistoryRows")
        .withIndex("by_questionArtifactHash", (query) =>
          query.eq("questionArtifactHash", artifactHash)
        )
        .first()
    ),
  ]);
  return answer !== null || question !== null;
});

/** Confirms both artifacts remain present before their hashes become durable. */
const verifyPlacementArtifacts = Effect.fn(
  "tryouts.history.verifyPlacementArtifacts"
)(function* (ctx: MutationCtx, source: Doc<"tryoutPlacements">) {
  const [answer, question] = yield* Effect.all([
    historyRead("Unable to read the retained answer artifact.", () =>
      ctx.db
        .query("contentArtifacts")
        .withIndex("by_artifactHash", (query) =>
          query.eq("artifactHash", source.answerArtifactHash)
        )
        .unique()
    ),
    historyRead("Unable to read the retained question artifact.", () =>
      ctx.db
        .query("contentArtifacts")
        .withIndex("by_artifactHash", (query) =>
          query.eq("artifactHash", source.questionArtifactHash)
        )
        .unique()
    ),
  ]);
  if (!(answer && question)) {
    return yield* historyFail(
      "TRYOUT_HISTORY_NOT_READY",
      `Placement ${source.identity} is missing a retained content artifact.`
    );
  }
});

/** Authenticates one current snapshot row and builds its immutable envelope. */
const buildHistoryRow = Effect.fn("tryouts.history.buildHistoryRow")(function* (
  ctx: MutationCtx,
  source: SourceRow,
  plan: RetainedTryoutHistoryPlan
) {
  if ("kind" in source) {
    const decoded = yield* decodeHistoryRowJson(
      source.rowJson,
      source.identity
    );
    if (
      decoded.rowKind !== "catalog" ||
      source.snapshotId !== plan.snapshotId ||
      source.locale !== decoded.record.row.locale ||
      source.identity !== tryoutCatalogIdentity(decoded.record.row) ||
      source.rowHash !== decoded.record.rowHash
    ) {
      return yield* historyFail(
        "TRYOUT_HISTORY_INTEGRITY",
        `Catalog source ${source.identity} failed its authenticated identity.`
      );
    }
    return {
      index: source.index,
      rowHash: source.rowHash,
      rowJson: source.rowJson,
      rowKind: "catalog",
      snapshotId: source.snapshotId,
    } satisfies HistoryValues;
  }

  const decoded = yield* decodeHistoryRowJson(source.rowJson, source.identity);
  if (
    decoded.rowKind !== "placement" ||
    source.snapshotId !== plan.snapshotId ||
    source.locale !== decoded.record.row.locale ||
    source.identity !== tryoutPlacementIdentity(decoded.record.row) ||
    source.rowHash !== decoded.record.rowHash ||
    source.answerArtifactHash !== decoded.record.row.answerArtifactHash ||
    source.questionArtifactHash !== decoded.record.row.questionArtifactHash
  ) {
    return yield* historyFail(
      "TRYOUT_HISTORY_INTEGRITY",
      `Placement source ${source.identity} failed its authenticated identity.`
    );
  }
  yield* verifyPlacementArtifacts(ctx, source);
  return {
    answerArtifactHash: source.answerArtifactHash,
    index: source.index,
    questionArtifactHash: source.questionArtifactHash,
    rowHash: source.rowHash,
    rowJson: source.rowJson,
    rowKind: "placement",
    snapshotId: source.snapshotId,
  } satisfies HistoryValues;
});

/** Checks byte identity for one idempotently retried history row. */
function hasExactHistoryValues(stored: HistoryRow, values: HistoryValues) {
  if (
    stored.index !== values.index ||
    stored.rowHash !== values.rowHash ||
    stored.rowJson !== values.rowJson ||
    stored.rowKind !== values.rowKind ||
    stored.snapshotId !== values.snapshotId
  ) {
    return false;
  }
  if (stored.rowKind === "catalog" && values.rowKind === "catalog") {
    return true;
  }
  if (stored.rowKind === "placement" && values.rowKind === "placement") {
    return (
      stored.answerArtifactHash === values.answerArtifactHash &&
      stored.questionArtifactHash === values.questionArtifactHash
    );
  }
  return false;
}

/** Stores or exactly reuses one authenticated immutable history row. */
export const retainHistoryRow = Effect.fn("tryouts.history.retainHistoryRow")(
  function* (
    ctx: MutationCtx,
    source: SourceRow,
    plan: RetainedTryoutHistoryPlan
  ) {
    const values = yield* buildHistoryRow(ctx, source, plan);
    const [byHash, byIndex] = yield* Effect.all([
      historyRead("Unable to read retained history row hash.", () =>
        ctx.db
          .query("tryoutHistoryRows")
          .withIndex("by_snapshotId_and_rowKind_and_rowHash", (query) =>
            query
              .eq("snapshotId", values.snapshotId)
              .eq("rowKind", values.rowKind)
              .eq("rowHash", values.rowHash)
          )
          .unique()
      ),
      historyRead("Unable to read retained history row index.", () =>
        ctx.db
          .query("tryoutHistoryRows")
          .withIndex("by_snapshotId_and_rowKind_and_index", (query) =>
            query
              .eq("snapshotId", values.snapshotId)
              .eq("rowKind", values.rowKind)
              .eq("index", values.index)
          )
          .unique()
      ),
    ]);

    if (byHash || byIndex) {
      if (
        byHash?._id !== byIndex?._id ||
        !byHash ||
        !hasExactHistoryValues(byHash, values)
      ) {
        return yield* historyFail(
          "TRYOUT_HISTORY_CONFLICT",
          `History row ${values.snapshotId}/${values.index} already has different bytes.`
        );
      }
      return "unchanged";
    }

    yield* ensureDocumentSize(
      `Retained try-out history row ${values.snapshotId}/${values.index}`,
      values
    ).pipe(Effect.mapError((error) => historyIntegrity(error.message)));
    yield* historyWrite("Unable to retain authenticated try-out history.", () =>
      ctx.db.insert("tryoutHistoryRows", values)
    );
    return "created";
  }
);
