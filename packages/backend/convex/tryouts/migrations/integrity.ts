import type {
  Doc,
  TableNames,
} from "@repo/backend/convex/_generated/dataModel";
import type { QueryCtx } from "@repo/backend/convex/_generated/server";
import { internalQuery } from "@repo/backend/convex/_generated/server";
import { runConvexProgram } from "@repo/backend/convex/lib/effect";
import { bindLegacySet } from "@repo/backend/convex/tryouts/migrations/catalog";
import {
  hasLegacySectionSource,
  isSignedAttempt,
} from "@repo/backend/convex/tryouts/migrations/signed";
import {
  migrationFail,
  migrationPageOptions,
  type TryoutMigrationEmpty,
  tryoutMigrationEmptyValidator,
  tryoutMigrationProofValidator,
  validateMigrationPage,
} from "@repo/backend/convex/tryouts/migrations/spec";
import { paginationOptsValidator } from "convex/server";
import { type Infer, v } from "convex/values";
import { Effect } from "effect";

const proofTableValidator = v.union(
  v.literal("attempts"),
  v.literal("calibrationRuns"),
  v.literal("irtItems"),
  v.literal("placements"),
  v.literal("progress"),
  v.literal("responses"),
  v.literal("scaleVersions"),
  v.literal("scores"),
  v.literal("sectionAttempts")
);

const proofArgs = {
  expectedProcessed: v.number(),
  expectedSnapshotId: v.string(),
  expectedTotal: v.number(),
  paginationOpts: paginationOptsValidator,
  table: proofTableValidator,
};
type ProofArgs = {
  readonly [Key in keyof typeof proofArgs]: Infer<(typeof proofArgs)[Key]>;
};

/** Reads one bounded proof page for the selected migration surface. */
const inspectMigrationPage = Effect.fn(
  "tryouts.migrations.inspectMigrationPage"
)(function* (ctx: QueryCtx, args: ProofArgs) {
  switch (args.table) {
    case "attempts":
      return yield* readAttemptProofPage(ctx, args);
    case "calibrationRuns":
      return yield* readProofPage(
        ctx,
        "irtCalibrationRuns",
        args,
        (row) =>
          row.scaleVersionId !== undefined && row.sectionIdentity !== undefined,
        (row) => row.tryoutSectionId !== undefined
      );
    case "irtItems":
      return yield* readProofPage(
        ctx,
        "irtScaleItems",
        args,
        (row) =>
          row.placementIdentity !== undefined &&
          row.placementRowHash !== undefined,
        (row) =>
          row.questionId !== undefined ||
          row.questionSourceKey !== undefined ||
          row.sourceRevision !== undefined ||
          row.contentHash !== undefined
      );
    case "placements":
      return yield* readProofPage(
        ctx,
        "tryoutAttemptPlacements",
        args,
        (row) =>
          row.answerArtifactHash !== undefined &&
          row.answerContentKey !== undefined &&
          row.placementIdentity !== undefined &&
          row.placementRowHash !== undefined &&
          row.questionArtifactHash !== undefined &&
          row.questionContentKey !== undefined &&
          row.rendererDomain !== undefined &&
          row.sectionIdentity !== undefined &&
          row.sectionKey !== undefined,
        (row) =>
          row.tryoutSectionId !== undefined ||
          row.questionId !== undefined ||
          row.questionSourceKey !== undefined ||
          row.contentHash !== undefined
      );
    case "progress":
      return yield* readProofPage(
        ctx,
        "tryoutSetProgress",
        args,
        (row) => row.setIdentity !== undefined,
        (row) => row.tryoutSetId !== undefined
      );
    case "responses":
      return yield* readProofPage(
        ctx,
        "tryoutResponses",
        args,
        () => true,
        (row) => row.questionId !== undefined
      );
    case "scaleVersions":
      return yield* readProofPage(
        ctx,
        "irtScaleVersions",
        args,
        (row) =>
          row.setIdentity !== undefined &&
          (row.tryoutSnapshotId === undefined ||
            row.tryoutSnapshotId === args.expectedSnapshotId),
        (row) => row.tryoutSetId !== undefined
      );
    case "scores":
      return yield* readProofPage(
        ctx,
        "tryoutScores",
        args,
        (row) =>
          row.tryoutSnapshotId === args.expectedSnapshotId &&
          row.setIdentity !== undefined &&
          (row.scoringStrategy !== "irt" || row.scaleVersionId !== undefined),
        (row) => row.tryoutSetId !== undefined
      );
    case "sectionAttempts":
      return yield* readProofPage(
        ctx,
        "tryoutSectionAttempts",
        args,
        (row) => row.sectionIdentity !== undefined,
        (row) => row.tryoutSectionId !== undefined
      );
    default:
      return yield* migrationFail("Unsupported try-out migration proof table.");
  }
});

/** Reads one attempt page and verifies every route against its signed set. */
const readAttemptProofPage = Effect.fn(
  "tryouts.migrations.readAttemptProofPage"
)(function* (ctx: QueryCtx, args: ProofArgs) {
  const page = yield* Effect.promise(() =>
    ctx.db
      .query("tryoutAttempts")
      .paginate(migrationPageOptions(args.paginationOpts))
  );
  const processed = yield* validateMigrationPage({
    expectedProcessed: args.expectedProcessed,
    expectedTotal: args.expectedTotal,
    numItems: args.paginationOpts.numItems,
    page,
    table: "tryoutAttempts",
  });
  const states = yield* Effect.forEach(page.page, (row) =>
    inspectAttemptRow(ctx, args.expectedSnapshotId, row)
  );
  return {
    continueCursor: page.continueCursor,
    isDone: page.isDone,
    legacy: states.filter(({ legacy }) => legacy).length,
    prepared: states.filter(({ prepared }) => prepared).length,
    processed,
    scanned: page.page.length,
  };
});

/** Checks one attempt's signed fields against its authenticated legacy set. */
const inspectAttemptRow = Effect.fn("tryouts.migrations.inspectAttemptRow")(
  function* (
    ctx: QueryCtx,
    expectedSnapshotId: string,
    row: Doc<"tryoutAttempts">
  ) {
    const legacy = row.tryoutSetId !== undefined || hasLegacySectionSource(row);
    if (isSignedAttempt(row, expectedSnapshotId)) {
      return { legacy, prepared: true };
    }
    const set = yield* bindLegacySet(ctx, expectedSnapshotId, row.tryoutSetId);
    return {
      legacy,
      prepared:
        row.setIdentity === set.identity &&
        row.countryKey === set.row.countryKey &&
        row.examKey === set.row.examKey &&
        row.trackKey === set.row.trackKey &&
        row.setKey === set.row.setKey &&
        row.locale === set.row.locale &&
        row.sectionSnapshots.every(
          (section) =>
            section.sectionIdentity !== undefined &&
            section.sectionRowHash !== undefined
        ),
    };
  }
);

/** Proves that technical queues without a safe migration path remain empty. */
const inspectEmptyTables = Effect.fn("tryouts.migrations.inspectEmptyTables")(
  function* (ctx: QueryCtx) {
    const rows = yield* Effect.all({
      calibrationAttempts: firstRow(ctx, "irtCalibrationAttempts"),
      calibrationCache: firstRow(ctx, "irtCalibrationCacheStats"),
      calibrationQueue: firstRow(ctx, "irtCalibrationQueue"),
      leaderboardEntries: firstRow(ctx, "tryoutLeaderboardEntries"),
      leaderboardScopes: firstRow(ctx, "tryoutLeaderboardScopes"),
      publicationQueue: firstRow(ctx, "irtScalePublicationQueue"),
      qualityChecks: firstRow(ctx, "irtScaleQualityChecks"),
      qualityQueue: firstRow(ctx, "irtScaleQualityRefreshQueue"),
    });
    const occupied = Object.entries(rows)
      .filter(([, row]) => row !== null)
      .map(([table]) => table);
    if (occupied.length > 0) {
      return yield* migrationFail(
        `Try-out migration requires empty technical tables: ${occupied.join(", ")}.`
      );
    }
    const result: TryoutMigrationEmpty = { empty: true };
    return result;
  }
);

/** Reads and summarizes one server-bounded proof page. */
function readProofPage<TableName extends TableNames>(
  ctx: QueryCtx,
  table: TableName,
  args: ProofArgs,
  isPrepared: (row: Doc<TableName>) => boolean,
  hasLegacy: (row: Doc<TableName>) => boolean
) {
  return Effect.promise(() =>
    ctx.db.query(table).paginate(migrationPageOptions(args.paginationOpts))
  ).pipe(
    Effect.flatMap((page) =>
      validateMigrationPage({
        expectedProcessed: args.expectedProcessed,
        expectedTotal: args.expectedTotal,
        numItems: args.paginationOpts.numItems,
        page,
        table,
      }).pipe(
        Effect.map((processed) => ({
          continueCursor: page.continueCursor,
          isDone: page.isDone,
          legacy: page.page.filter(hasLegacy).length,
          prepared: page.page.filter(isPrepared).length,
          processed,
          scanned: page.page.length,
        }))
      )
    )
  );
}

/** Reads at most one row from a table required to remain empty. */
function firstRow<TableName extends TableNames>(
  ctx: QueryCtx,
  table: TableName
) {
  return Effect.promise(() => ctx.db.query(table).first());
}

/** Reports one paginated migration proof surface. */
export const inspect = internalQuery({
  args: proofArgs,
  returns: tryoutMigrationProofValidator,
  handler: (ctx, args) => runConvexProgram(inspectMigrationPage(ctx, args)),
});

/** Proves that every unsupported technical queue is empty. */
export const inspectEmpty = internalQuery({
  args: {},
  returns: tryoutMigrationEmptyValidator,
  handler: (ctx) => runConvexProgram(inspectEmptyTables(ctx)),
});
