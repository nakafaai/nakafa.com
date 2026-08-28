import { strict as assert } from "node:assert/strict";
import {
  tryoutCatalogIdentity,
  tryoutCatalogNodeIdentity,
  tryoutPlacementIdentity,
} from "@nakafa/aksara-contracts/tryout/identity";
import type { Id } from "@repo/backend/convex/_generated/dataModel";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import type schema from "@repo/backend/convex/schema";
import type { ScaleRepairEvidence } from "@repo/backend/convex/tryouts/migration/cleanup/evidence";
import {
  makeRepairSource,
  RETAINED_SECTION_KEY,
  type RepairSource,
  seedRepairSource,
} from "@repo/backend/test/migration/retained";
import { seedCleanupSuccess } from "@repo/backend/test/migration/seed";
import { CLEANUP_SOURCE_SNAPSHOT } from "@repo/backend/test/migration/state";
import type { TestConvex } from "convex-test";

const REPAIR_PUBLISHED_AT = 20;
type CleanupTest = TestConvex<typeof schema>;

/** Seeds the exact zero-use provisional graph omitted by attempt inventory. */
export async function seedUnusedScale(
  ctx: MutationCtx,
  source: readonly RepairSource[],
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
        placementRowHash:
          row.historical?.record.rowHash ?? row.placement.record.rowHash,
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
  sectionKeys: readonly string[] = [RETAINED_SECTION_KEY]
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
