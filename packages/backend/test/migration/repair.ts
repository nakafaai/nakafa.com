import { strict as assert } from "node:assert/strict";
import type { Id } from "@repo/backend/convex/_generated/dataModel";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import type schema from "@repo/backend/convex/schema";
import type { ScaleRepairEvidence } from "@repo/backend/convex/tryouts/migration/cleanup/evidence";
import { seedCleanupSuccess } from "@repo/backend/test/migration/seed";
import {
  CLEANUP_SOURCE_SNAPSHOT,
  type CleanupSourceInventory,
} from "@repo/backend/test/migration/state";
import type { TestConvex } from "convex-test";

const REPAIR_PUBLISHED_AT = 20;
type CleanupTest = TestConvex<typeof schema>;
const repairHashes = {
  "english-language": {
    placement:
      "sha256:4e5e666678434bd288e326190030a91111f2756a683d3580d3aa1788e3c1dcf8",
    section:
      "sha256:b819e3469bd3413932059526a523d47ec0a895b1f620b3735270fd31c8f8e22d",
  },
  "general-reasoning": {
    placement:
      "sha256:2bf92b47875b9ead349b5416397dffc6b76db9543749c2a6c33f48c77c9b48d7",
    section:
      "sha256:3b7e00e4f173ea16c29749bfc46385da19f224ddc9a337484fd51fc56702ea63",
  },
} as const;
type RepairSectionKey = keyof typeof repairHashes;

/** Builds one frozen history fixture without exposing an old writer. */
function makeRepairSource(sectionKey: RepairSectionKey) {
  const hashes = repairHashes[sectionKey];
  const questionRoot = `question-bank/tryout/indonesia/snbt/${sectionKey}/set-2/question-1`;
  const section = {
    family: "tryout",
    record: {
      row: {
        countryKey: "indonesia",
        examKey: "snbt",
        graph: {
          alignmentId: `alignment:tryout:${sectionKey}`,
          assetId: `asset:tryout:${sectionKey}`,
          conceptId: `concept:tryout:${sectionKey}`,
          learningObjectId: `lo:tryout-${sectionKey}`,
          lensId: "lens:tryout:test",
        },
        kind: "section",
        locale: "en",
        order: 1,
        publicPath: `try-out/indonesia/snbt/2027/set-2/${sectionKey}`,
        questionCount: 1,
        questionSourcePath: `packages/corpus/question-bank/tryout/indonesia/snbt/${sectionKey}/set-2`,
        sectionKey,
        setKey: "set-2",
        sourceRevision: "retained-source",
        timeLimitSeconds: 1800,
        title: sectionKey,
        trackKey: "2027",
        visibility: "visible",
      },
      rowHash: hashes.section,
    },
    rowKind: "catalog",
  } as const;
  const placement = {
    family: "tryout",
    record: {
      row: {
        answerArtifactHash: `sha256:${"c".repeat(64)}`,
        answerContentKey: `${questionRoot}/answer`,
        choices: [
          { isCorrect: true, label: "A", optionKey: "option-1", order: 1 },
          { isCorrect: false, label: "B", optionKey: "option-2", order: 2 },
        ],
        countryKey: "indonesia",
        examKey: "snbt",
        locale: "en",
        questionArtifactHash: `sha256:${"d".repeat(64)}`,
        questionContentKey: `${questionRoot}/question`,
        questionOrder: 1,
        questionSourcePath: `packages/corpus/${questionRoot}`,
        rendererDomain: "snbt-general",
        scope: "server",
        sectionKey,
        setKey: "set-2",
        sourceRevision: "retained-source",
        title: "Question 1",
        trackKey: "2027",
      },
      rowHash: hashes.placement,
    },
    rowKind: "placement",
  } as const;
  return { placement, section };
}

/** Replaces placeholders with the authenticated history-only source shape. */
async function seedRepairSource(
  ctx: MutationCtx,
  source: readonly ReturnType<typeof makeRepairSource>[]
) {
  const catalogs = await ctx.db
    .query("tryoutHistoryRows")
    .withIndex("by_snapshotId_and_rowKind_and_index", (query) =>
      query.eq("snapshotId", CLEANUP_SOURCE_SNAPSHOT).eq("rowKind", "catalog")
    )
    .take(source.length);
  const placements = await ctx.db
    .query("tryoutHistoryRows")
    .withIndex("by_snapshotId_and_rowKind_and_index", (query) =>
      query.eq("snapshotId", CLEANUP_SOURCE_SNAPSHOT).eq("rowKind", "placement")
    )
    .take(source.length);
  assert.strictEqual(catalogs.length, source.length);
  assert.strictEqual(placements.length, source.length);
  for (const [index, row] of source.entries()) {
    const catalog = catalogs[index];
    const placement = placements[index];
    assert.ok(catalog && placement);
    await ctx.db.replace("tryoutHistoryRows", catalog._id, {
      index: catalog.index,
      rowHash: row.section.record.rowHash,
      rowJson: JSON.stringify(row.section),
      rowKind: "catalog",
      snapshotId: CLEANUP_SOURCE_SNAPSHOT,
    });
    await ctx.db.replace("tryoutHistoryRows", placement._id, {
      answerArtifactHash: row.placement.record.row.answerArtifactHash,
      index: placement.index,
      questionArtifactHash: row.placement.record.row.questionArtifactHash,
      rowHash: row.placement.record.rowHash,
      rowJson: JSON.stringify(row.placement),
      rowKind: "placement",
      snapshotId: CLEANUP_SOURCE_SNAPSHOT,
    });
  }
  const transitionRows = await Promise.all([
    ctx.db
      .query("tryoutCatalog")
      .withIndex("by_snapshotId_and_index", (query) =>
        query.eq("snapshotId", CLEANUP_SOURCE_SNAPSHOT)
      )
      .collect(),
    ctx.db
      .query("tryoutPlacements")
      .withIndex("by_snapshotId_and_index", (query) =>
        query.eq("snapshotId", CLEANUP_SOURCE_SNAPSHOT)
      )
      .collect(),
  ]);
  for (const rows of transitionRows) {
    for (const row of rows) {
      await ctx.db.delete(row._id);
    }
  }
}

/** Seeds the exact zero-use provisional graph omitted by attempt inventory. */
export async function seedUnusedScale(
  ctx: MutationCtx,
  source: readonly ReturnType<typeof makeRepairSource>[],
  responseCount = 0
) {
  const first = source[0];
  assert.ok(first);
  const firstPlacement = first.placement.record.row;
  const setIdentity = historicalCatalogIdentity(firstPlacement, "set");
  const scaleVersionId = await ctx.db.insert("irtScaleVersions", {
    model: "2pl",
    publishedAt: REPAIR_PUBLISHED_AT,
    questionCount: source.length,
    setIdentity,
    status: "provisional",
    tryoutSnapshotId: CLEANUP_SOURCE_SNAPSHOT,
  });
  const itemIds: Id<"irtScaleItems">[] = [];
  const runIds: Id<"irtCalibrationRuns">[] = [];
  for (const row of source) {
    const sectionIdentity = historicalCatalogIdentity(
      row.section.record.row,
      "section"
    );
    const runId = await ctx.db.insert("irtCalibrationRuns", {
      attemptCount: 0,
      completedAt: REPAIR_PUBLISHED_AT,
      iterationCount: 0,
      maxParameterDelta: 0,
      model: "2pl",
      questionCount: 1,
      responseCount,
      scaleVersionId,
      sectionIdentity,
      startedAt: REPAIR_PUBLISHED_AT,
      status: "completed",
      updatedAt: REPAIR_PUBLISHED_AT,
    });
    runIds.push(runId);
    itemIds.push(
      await ctx.db.insert("irtScaleItems", {
        calibrationRunId: runId,
        calibrationStatus: "provisional",
        correctRate: 0,
        difficulty: 0,
        discrimination: 1,
        placementIdentity: historicalPlacementIdentity(
          row.placement.record.row
        ),
        placementRowHash: row.placement.record.rowHash,
        responseCount: 0,
        scaleVersionId,
      })
    );
  }
  return {
    evidence: {
      itemCount: source.length,
      publishedAt: REPAIR_PUBLISHED_AT,
      questionCount: source.length,
      runs: source.map((row) => ({
        questionCount: 1,
        sectionIdentity: historicalCatalogIdentity(
          row.section.record.row,
          "section"
        ),
      })),
      setIdentity,
    },
    itemIds,
    runIds,
    scaleVersionId,
  };
}

/** Seeds signed cleanup plus one authenticated provisional repair graph. */
export async function seedRepair(
  test: CleanupTest,
  responseCount = 0,
  sectionKeys: readonly RepairSectionKey[] = ["general-reasoning"]
) {
  const source = sectionKeys.map(makeRepairSource);
  const sourceInventory: CleanupSourceInventory = {
    catalogRowCount: source.length,
    placementRowCount: source.length,
  };
  const cleanup = await seedCleanupSuccess(test, 1, sourceInventory);
  const repair = await test.mutation(async (ctx) => {
    const migration = await ctx.db.query("tryoutHistoryMigrations").unique();
    assert.ok(migration?.phase === "completed");
    await seedRepairSource(ctx, source);
    const graph = await seedUnusedScale(ctx, source, responseCount);
    return {
      ...graph,
      evidence: {
        ...graph.evidence,
        migrationId: migration.migrationId,
        planHash: migration.authorization.planHash,
        scaleVersionId: graph.scaleVersionId,
        sourceSnapshotId: migration.sourceSnapshotId,
      } satisfies ScaleRepairEvidence,
    };
  });
  return { cleanup, repair, source };
}

/** Reconstructs the frozen catalog identity used by retained scale rows. */
function historicalCatalogIdentity(
  row: {
    readonly countryKey: string;
    readonly examKey: string;
    readonly locale: string;
    readonly sectionKey?: string;
    readonly setKey: string;
    readonly trackKey: string;
  },
  kind: "section" | "set"
) {
  return [
    row.locale,
    kind,
    row.countryKey,
    row.examKey,
    row.trackKey,
    row.setKey,
    kind === "section" ? row.sectionKey : "",
  ].join("\0");
}

/** Reconstructs one exact historical placement identity for test rows. */
function historicalPlacementIdentity(row: {
  readonly countryKey: string;
  readonly examKey: string;
  readonly locale: string;
  readonly questionContentKey: string;
  readonly questionOrder: number;
  readonly sectionKey: string;
  readonly setKey: string;
  readonly trackKey: string;
}) {
  return [
    row.countryKey,
    row.examKey,
    row.trackKey,
    row.setKey,
    row.sectionKey,
    row.questionOrder,
    row.questionContentKey,
    row.locale,
  ].join("\0");
}
