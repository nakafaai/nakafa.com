import { strict as assert } from "node:assert/strict";
import {
  ContentKeySchema,
  CorpusSourcePathSchema,
} from "@nakafa/aksara-contracts/ids";
import { canonicalizeContentSnapshotRow } from "@nakafa/aksara-contracts/release/snapshot/data";
import { makeTryoutCatalogRecord } from "@nakafa/aksara-contracts/tryout/catalog-hash";
import {
  tryoutCatalogIdentity,
  tryoutCatalogNodeIdentity,
  tryoutPlacementIdentity,
} from "@nakafa/aksara-contracts/tryout/identity";
import { makeTryoutPlacementRecord } from "@nakafa/aksara-contracts/tryout/placement-hash";
import type { Id } from "@repo/backend/convex/_generated/dataModel";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import {
  tryoutCatalogFacts,
  tryoutPlacementFacts,
} from "@repo/backend/convex/contentRelease/tryout/facts";
import type schema from "@repo/backend/convex/schema";
import type { ScaleRepairEvidence } from "@repo/backend/convex/tryouts/migration/cleanup/evidence";
import { seedCleanupSuccess } from "@repo/backend/test/migration/seed";
import { CLEANUP_SOURCE_SNAPSHOT } from "@repo/backend/test/migration/state";
import { makeTryoutPlacementRow } from "@repo/backend/test/tryout/snapshot";
import { makeTryoutStartCatalog } from "@repo/backend/test/tryout/source";
import type { TestConvex } from "convex-test";

const REPAIR_PUBLISHED_AT = 20;
type CleanupTest = TestConvex<typeof schema>;

/** Builds one signed section and placement selected by the repair graph. */
function makeRepairSource(sectionKey: string, order: number) {
  const baseSection = makeTryoutStartCatalog("en", "visible", "irt").find(
    (row) => row.kind === "section"
  );
  assert.ok(baseSection?.kind === "section");
  const section = {
    family: "tryout",
    record: makeTryoutCatalogRecord({
      ...baseSection,
      examKey: "snbt",
      order,
      questionCount: 1,
      sectionKey,
      setKey: "set-2",
      trackKey: "2027",
    }),
    rowKind: "catalog",
  } as const;
  const basePlacement = makeTryoutPlacementRow("en");
  const questionRoot = `question-bank/tryout/indonesia/snbt/${sectionKey}/set-2/question-1`;
  const placement = {
    family: "tryout",
    record: makeTryoutPlacementRecord({
      ...basePlacement.record.row,
      answerContentKey: ContentKeySchema.make(`${questionRoot}/answer`),
      examKey: "snbt",
      questionContentKey: ContentKeySchema.make(`${questionRoot}/question`),
      questionOrder: 1,
      questionSourcePath: CorpusSourcePathSchema.make(
        `packages/corpus/${questionRoot}`
      ),
      sectionKey,
      setKey: "set-2",
      trackKey: "2027",
    }),
    rowKind: "placement",
  } as const;
  return { placement, section };
}

/** Replaces legacy test placeholders with authenticated source rows. */
async function seedRepairSource(
  ctx: MutationCtx,
  source: readonly ReturnType<typeof makeRepairSource>[]
) {
  const catalogs = await ctx.db
    .query("tryoutCatalog")
    .withIndex("by_snapshotId_and_index", (query) =>
      query.eq("snapshotId", CLEANUP_SOURCE_SNAPSHOT)
    )
    .take(source.length);
  const placements = await ctx.db
    .query("tryoutPlacements")
    .withIndex("by_snapshotId_and_index", (query) =>
      query.eq("snapshotId", CLEANUP_SOURCE_SNAPSHOT)
    )
    .take(source.length);
  assert.ok(catalogs.length === source.length && placements[0]);
  for (const [index, row] of source.entries()) {
    const catalog = catalogs[index];
    assert.ok(catalog);
    await ctx.db.replace("tryoutCatalog", catalog._id, {
      ...tryoutCatalogFacts(row.section.record),
      index: catalog.index,
      rowHash: row.section.record.rowHash,
      rowJson: canonicalizeContentSnapshotRow(row.section),
      snapshotId: CLEANUP_SOURCE_SNAPSHOT,
    });
    const stored = placements[index];
    const next = {
      ...tryoutPlacementFacts(row.placement.record),
      index: stored?.index ?? index + 1,
      rowHash: row.placement.record.rowHash,
      rowJson: canonicalizeContentSnapshotRow(row.placement),
      snapshotId: CLEANUP_SOURCE_SNAPSHOT,
    };
    if (stored) {
      await ctx.db.replace("tryoutPlacements", stored._id, next);
    } else {
      await ctx.db.insert("tryoutPlacements", next);
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
  const setIdentity = tryoutCatalogNodeIdentity({
    appLocale: firstPlacement.appLocale,
    countryKey: firstPlacement.countryKey,
    examKey: firstPlacement.examKey,
    kind: "set",
    setKey: firstPlacement.setKey,
    trackKey: firstPlacement.trackKey,
  });
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
    const sectionIdentity = tryoutCatalogIdentity(row.section.record.row);
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
        placementIdentity: tryoutPlacementIdentity(row.placement.record.row),
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
        sectionIdentity: tryoutCatalogIdentity(row.section.record.row),
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
  sectionKeys: readonly string[] = ["quantitative-knowledge"]
) {
  const cleanup = await seedCleanupSuccess(test);
  const source = sectionKeys.map((sectionKey, index) =>
    makeRepairSource(sectionKey, index + 1)
  );
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
