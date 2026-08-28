import { MAX_TRYOUT_HISTORY_MIGRATION_ROWS } from "@nakafa/aksara-contracts/transport/migration/tryout/request";
import type { QueryCtx } from "@repo/backend/convex/_generated/server";
import { internalQuery } from "@repo/backend/convex/_generated/server";
import { releaseFail } from "@repo/backend/convex/contentRelease/error";
import { runConvexProgram } from "@repo/backend/convex/lib/effect";
import { retainedTryoutHistoryPlan } from "@repo/backend/convex/tryouts/history/spec";
import { v } from "convex/values";
import { Effect } from "effect";

export const rowKindValidator = v.union(
  v.literal("catalog"),
  v.literal("placement")
);
export const storedRowValidator = v.object({
  index: v.number(),
  rowHash: v.string(),
  rowJson: v.string(),
});
export const rowPageValidator = v.object({
  isDone: v.boolean(),
  nextIndex: v.union(v.number(), v.null()),
  rowKind: rowKindValidator,
  rows: v.array(storedRowValidator),
});
export const storedArtifactValidator = v.object({
  artifactHash: v.string(),
  artifactJson: v.string(),
});

/** Reads one exact, contiguous historical row page in source index order. */
const readRowPage = Effect.fn("tryouts.migration.readRowPage")(function* (
  ctx: QueryCtx,
  args: {
    readonly afterIndex: number;
    readonly rowKind: "catalog" | "placement";
    readonly sourceSnapshotId: string;
  }
) {
  if (args.sourceSnapshotId !== retainedTryoutHistoryPlan.snapshotId) {
    return yield* releaseFail(
      "CONTENT_RELEASE_INTEGRITY",
      "Unexpected retained try-out snapshot."
    );
  }
  const page = yield* Effect.promise(() =>
    ctx.db
      .query("tryoutHistoryRows")
      .withIndex("by_snapshotId_and_rowKind_and_index", (query) =>
        query
          .eq("snapshotId", args.sourceSnapshotId)
          .eq("rowKind", args.rowKind)
          .gt("index", args.afterIndex)
      )
      .take(MAX_TRYOUT_HISTORY_MIGRATION_ROWS + 1)
  );
  const rows = page.slice(0, MAX_TRYOUT_HISTORY_MIGRATION_ROWS);
  let firstIndex = args.afterIndex + 1;
  if (args.afterIndex < 0) {
    firstIndex =
      args.rowKind === "catalog"
        ? retainedTryoutHistoryPlan.firstCatalogIndex
        : retainedTryoutHistoryPlan.firstPlacementIndex;
  }
  for (const [offset, row] of rows.entries()) {
    if (row.index !== firstIndex + offset) {
      return yield* releaseFail(
        "CONTENT_RELEASE_INTEGRITY",
        "Retained try-out row indices are not contiguous."
      );
    }
  }
  const isDone = page.length <= MAX_TRYOUT_HISTORY_MIGRATION_ROWS;
  return {
    isDone,
    nextIndex: isDone ? null : (rows.at(-1)?.index ?? null),
    rowKind: args.rowKind,
    rows: rows.map(({ index, rowHash, rowJson }) => ({
      index,
      rowHash,
      rowJson,
    })),
  };
});

/** Reads exact old rows selected by a bounded conversion batch. */
const readRowBatch = Effect.fn("tryouts.migration.readRowBatch")(function* (
  ctx: QueryCtx,
  rowHashes: readonly string[],
  rowKind: "catalog" | "placement",
  sourceSnapshotId: string
) {
  if (sourceSnapshotId !== retainedTryoutHistoryPlan.snapshotId) {
    return yield* releaseFail(
      "CONTENT_RELEASE_INTEGRITY",
      "Unexpected retained try-out snapshot."
    );
  }
  return yield* Effect.forEach(rowHashes, (rowHash) =>
    Effect.gen(function* () {
      const row = yield* Effect.promise(() =>
        ctx.db
          .query("tryoutHistoryRows")
          .withIndex("by_snapshotId_and_rowKind_and_rowHash", (query) =>
            query
              .eq("snapshotId", sourceSnapshotId)
              .eq("rowKind", rowKind)
              .eq("rowHash", rowHash)
          )
          .unique()
      );
      if (!row) {
        return yield* releaseFail(
          "CONTENT_RELEASE_MISSING",
          "Retained try-out row is missing."
        );
      }
      return { index: row.index, rowHash: row.rowHash, rowJson: row.rowJson };
    })
  );
});

/** Proves one old artifact hash is selected by the retained snapshot. */
const hasArtifactReference = Effect.fn(
  "tryouts.migration.hasArtifactReference"
)(function* (ctx: QueryCtx, artifactHash: string) {
  const [answer, question] = yield* Effect.all([
    Effect.promise(() =>
      ctx.db
        .query("tryoutHistoryRows")
        .withIndex("by_answerArtifactHash", (query) =>
          query.eq("answerArtifactHash", artifactHash)
        )
        .first()
    ),
    Effect.promise(() =>
      ctx.db
        .query("tryoutHistoryRows")
        .withIndex("by_questionArtifactHash", (query) =>
          query.eq("questionArtifactHash", artifactHash)
        )
        .first()
    ),
  ]);
  return (
    answer?.snapshotId === retainedTryoutHistoryPlan.snapshotId ||
    question?.snapshotId === retainedTryoutHistoryPlan.snapshotId
  );
});

/** Reads only exact artifacts already proven reachable from retained rows. */
const readArtifactBatch = Effect.fn("tryouts.migration.readArtifactBatch")(
  function* (
    ctx: QueryCtx,
    artifactHashes: readonly string[],
    sourceSnapshotId: string
  ) {
    if (sourceSnapshotId !== retainedTryoutHistoryPlan.snapshotId) {
      return yield* releaseFail(
        "CONTENT_RELEASE_INTEGRITY",
        "Unexpected retained try-out snapshot."
      );
    }
    return yield* Effect.forEach(artifactHashes, (artifactHash) =>
      Effect.gen(function* () {
        if (!(yield* hasArtifactReference(ctx, artifactHash))) {
          return yield* releaseFail(
            "CONTENT_RELEASE_INTEGRITY",
            "Artifact is not retained by try-out history."
          );
        }
        const artifact = yield* Effect.promise(() =>
          ctx.db
            .query("contentArtifacts")
            .withIndex("by_artifactHash", (query) =>
              query.eq("artifactHash", artifactHash)
            )
            .unique()
        );
        if (!artifact || artifact.artifactHash !== artifactHash) {
          return yield* releaseFail(
            "CONTENT_RELEASE_MISSING",
            "Retained try-out artifact is missing."
          );
        }
        return {
          artifactHash: artifact.artifactHash,
          artifactJson: artifact.artifactJson,
        };
      })
    );
  }
);

export const rowPage = internalQuery({
  args: {
    afterIndex: v.number(),
    rowKind: rowKindValidator,
    sourceSnapshotId: v.string(),
  },
  returns: rowPageValidator,
  handler: (ctx, args) => runConvexProgram(readRowPage(ctx, args)),
});

export const artifactBatch = internalQuery({
  args: {
    artifactHashes: v.array(v.string()),
    sourceSnapshotId: v.string(),
  },
  returns: v.array(storedArtifactValidator),
  handler: (ctx, args) =>
    runConvexProgram(
      readArtifactBatch(ctx, args.artifactHashes, args.sourceSnapshotId)
    ),
});

export const rowBatch = internalQuery({
  args: {
    rowHashes: v.array(v.string()),
    rowKind: rowKindValidator,
    sourceSnapshotId: v.string(),
  },
  returns: v.array(storedRowValidator),
  handler: (ctx, args) =>
    runConvexProgram(
      readRowBatch(ctx, args.rowHashes, args.rowKind, args.sourceSnapshotId)
    ),
});
