import { MAX_SIGNED_ARTIFACT_BYTES } from "@nakafa/aksara-contracts/limits";
import type { Doc } from "@repo/backend/convex/_generated/dataModel";
import type { QueryCtx } from "@repo/backend/convex/_generated/server";
import { internalQuery } from "@repo/backend/convex/_generated/server";
import { runConvexProgram } from "@repo/backend/convex/lib/effect";
import {
  historyFail,
  historyRead,
} from "@repo/backend/convex/tryouts/history/spec";
import { type Infer, v } from "convex/values";
import { Effect } from "effect";

const HISTORY_PAGE_BYTES = 2 * 1024 * 1024;
const PAGE_SIZE = 8;
const MAX_PAGE_BYTES =
  HISTORY_PAGE_BYTES + 2 * PAGE_SIZE * MAX_SIGNED_ARTIFACT_BYTES;
const MAX_PAGE_DOCUMENTS = 24;
const MAX_PAGE_QUERIES = 17;

const catalogRowValidator = v.object({
  index: v.number(),
  rowHash: v.string(),
  rowJson: v.string(),
  rowKind: v.literal("catalog"),
  snapshotId: v.string(),
});
const placementRowValidator = v.object({
  answerArtifactHash: v.string(),
  answerArtifactJson: v.string(),
  index: v.number(),
  questionArtifactHash: v.string(),
  questionArtifactJson: v.string(),
  rowHash: v.string(),
  rowJson: v.string(),
  rowKind: v.literal("placement"),
  snapshotId: v.string(),
});
const historyPageValidator = v.object({
  cursor: v.string(),
  done: v.boolean(),
  rows: v.array(v.union(catalogRowValidator, placementRowValidator)),
});

export type TerminalCatalogRow = Infer<typeof catalogRowValidator>;
export type TerminalHistoryPage = Infer<typeof historyPageValidator>;
export type TerminalPlacementRow = Infer<typeof placementRowValidator>;
export type TerminalStoredPlacement = Omit<
  TerminalPlacementRow,
  "answerArtifactJson" | "questionArtifactJson"
>;

/** Pages exact history envelopes and joins placement artifacts by signed hash. */
export const historyPage = internalQuery({
  args: { cursor: v.union(v.null(), v.string()) },
  returns: historyPageValidator,
  handler: (ctx, args) => runConvexProgram(readHistoryPage(ctx, args.cursor)),
});

export const readHistoryPage = Effect.fn(
  "tryouts.history.readTerminalHistoryPage"
)(function* (ctx: QueryCtx, cursor: null | string) {
  const page = yield* historyRead(
    "Unable to page terminal retained history.",
    () =>
      ctx.db.query("tryoutHistoryRows").paginate({
        cursor,
        maximumBytesRead: HISTORY_PAGE_BYTES,
        maximumRowsRead: PAGE_SIZE,
        numItems: PAGE_SIZE,
      })
  );
  const rows = yield* Effect.forEach(
    page.page,
    (row) => readHistoryRow(ctx, row),
    { concurrency: 4 }
  );
  yield* requirePageBudget(ctx);
  return {
    cursor: page.continueCursor,
    done: page.isDone,
    rows,
  };
});

const readHistoryRow = Effect.fn("tryouts.history.readTerminalHistoryRow")(
  function* (ctx: QueryCtx, row: Doc<"tryoutHistoryRows">) {
    if (row.rowKind === "catalog") {
      return {
        index: row.index,
        rowHash: row.rowHash,
        rowJson: row.rowJson,
        rowKind: row.rowKind,
        snapshotId: row.snapshotId,
      } satisfies TerminalCatalogRow;
    }
    const [answer, question] = yield* Effect.all([
      historyRead("Unable to read a terminal answer artifact.", () =>
        ctx.db
          .query("contentArtifacts")
          .withIndex("by_artifactHash", (index) =>
            index.eq("artifactHash", row.answerArtifactHash)
          )
          .unique()
      ),
      historyRead("Unable to read a terminal question artifact.", () =>
        ctx.db
          .query("contentArtifacts")
          .withIndex("by_artifactHash", (index) =>
            index.eq("artifactHash", row.questionArtifactHash)
          )
          .unique()
      ),
    ]);
    if (!(answer && question)) {
      return yield* historyFail(
        "TRYOUT_HISTORY_NOT_READY",
        `History placement ${row.rowHash} lost a retained artifact.`
      );
    }
    return {
      answerArtifactHash: row.answerArtifactHash,
      answerArtifactJson: answer.artifactJson,
      index: row.index,
      questionArtifactHash: row.questionArtifactHash,
      questionArtifactJson: question.artifactJson,
      rowHash: row.rowHash,
      rowJson: row.rowJson,
      rowKind: row.rowKind,
      snapshotId: row.snapshotId,
    } satisfies TerminalPlacementRow;
  }
);

const requirePageBudget = Effect.fn(
  "tryouts.history.requireTerminalPageBudget"
)(function* (ctx: QueryCtx) {
  const metrics = yield* historyRead(
    "Unable to read terminal history page metrics.",
    () => ctx.meta.getTransactionMetrics()
  );
  if (
    metrics.bytesRead.used > MAX_PAGE_BYTES ||
    metrics.databaseQueries.used > MAX_PAGE_QUERIES ||
    metrics.documentsRead.used > MAX_PAGE_DOCUMENTS
  ) {
    return yield* historyFail(
      "TRYOUT_HISTORY_READ_FAILED",
      `Terminal history page used ${metrics.bytesRead.used} bytes, ${metrics.databaseQueries.used} queries, and ${metrics.documentsRead.used} documents.`
    );
  }
});
