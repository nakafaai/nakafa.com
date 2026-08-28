import { strict as assert } from "node:assert/strict";
import { createHash } from "node:crypto";
import type { StoredTryoutPlacementRow } from "@nakafa/aksara-contracts/history/decode";
import {
  ContentKeySchema,
  CorpusSourcePathSchema,
  Sha256HashSchema,
} from "@nakafa/aksara-contracts/ids";
import { makeTryoutCatalogRecord } from "@nakafa/aksara-contracts/tryout/catalog-hash";
import {
  tryoutCatalogIdentity,
  tryoutCatalogNodeIdentity,
  tryoutPlacementIdentity,
} from "@nakafa/aksara-contracts/tryout/identity";
import { makeTryoutPlacementRecord } from "@nakafa/aksara-contracts/tryout/placement-hash";
import type { Id } from "@repo/backend/convex/_generated/dataModel";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import type schema from "@repo/backend/convex/schema";
import type { ScaleRepairEvidence } from "@repo/backend/convex/tryouts/migration/cleanup/evidence";
import { seedCleanupSuccess } from "@repo/backend/test/migration/seed";
import {
  CLEANUP_MIGRATION_ID,
  CLEANUP_SOURCE_SNAPSHOT,
} from "@repo/backend/test/migration/state";
import { makeTryoutPlacementRow } from "@repo/backend/test/tryout/snapshot";
import { makeTryoutStartCatalog } from "@repo/backend/test/tryout/source";
import type { TestConvex } from "convex-test";

const REPAIR_PUBLISHED_AT = 20;
type CleanupTest = TestConvex<typeof schema>;
type CleanupSeed = Awaited<ReturnType<typeof seedCleanupSuccess>>;

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
  const current = placement.record.row;
  assert.strictEqual(current.appLocale, "en");
  assert.strictEqual(current.rendererDomain, "snbt-quant");
  const historical = {
    answerArtifactHash: current.answerArtifactHash,
    answerContentKey: current.answerContentKey,
    choices: current.choices,
    contentHash: current.contentHash,
    countryKey: current.countryKey,
    examKey: current.examKey,
    locale: current.appLocale,
    questionArtifactHash: current.questionArtifactHash,
    questionContentKey: current.questionContentKey,
    questionOrder: current.questionOrder,
    questionSourcePath: current.questionSourcePath,
    rendererDomain: current.rendererDomain,
    scope: current.scope,
    sectionKey: current.sectionKey,
    setKey: current.setKey,
    sourceRevision: current.sourceRevision,
    title: "Question 1",
    trackKey: current.trackKey,
  };
  const historicalHash = Sha256HashSchema.make(
    `sha256:${createHash("sha256")
      .update(
        `nakafa.aksara.tryout-placements.v1\n${JSON.stringify(historical)}`
      )
      .digest("hex")}`
  );
  const retained = {
    family: "tryout",
    record: { row: historical, rowHash: historicalHash },
    rowKind: "placement",
  } satisfies StoredTryoutPlacementRow;
  return { placement, retained, section };
}

/** Replaces retained-history placeholders with authenticated placements. */
async function seedRepairSource(
  ctx: MutationCtx,
  cleanup: CleanupSeed,
  source: readonly ReturnType<typeof makeRepairSource>[]
) {
  const placements = await ctx.db
    .query("tryoutHistoryRows")
    .withIndex("by_snapshotId_and_rowKind_and_index", (query) =>
      query.eq("snapshotId", CLEANUP_SOURCE_SNAPSHOT).eq("rowKind", "placement")
    )
    .take(source.length);
  const mappings = await ctx.db
    .query("tryoutHistoryMigrationMaps")
    .withIndex("by_migrationId_and_kind_and_index", (query) =>
      query.eq("migrationId", CLEANUP_MIGRATION_ID).eq("kind", "placement")
    )
    .take(source.length);
  for (const [index, row] of source.entries()) {
    const stored = placements[index];
    const next = {
      answerArtifactHash: row.retained.record.row.answerArtifactHash,
      index: stored?.index ?? index + 33,
      questionArtifactHash: row.retained.record.row.questionArtifactHash,
      rowHash: row.retained.record.rowHash,
      rowJson: JSON.stringify(row.retained),
      rowKind: "placement" as const,
      snapshotId: CLEANUP_SOURCE_SNAPSHOT,
    };
    if (stored) {
      await ctx.db.replace("tryoutHistoryRows", stored._id, next);
    } else {
      await ctx.db.insert("tryoutHistoryRows", next);
    }
    const mapping = mappings[index];
    const mapped = {
      identity: tryoutPlacementIdentity(row.placement.record.row),
      index: mapping?.index ?? index,
      kind: "placement" as const,
      migrationId: CLEANUP_MIGRATION_ID,
      newHash: row.placement.record.rowHash,
      oldHash: row.retained.record.rowHash,
      targetCreated: false,
    };
    if (mapping) {
      await ctx.db.replace("tryoutHistoryMigrationMaps", mapping._id, mapped);
    } else {
      await ctx.db.insert("tryoutHistoryMigrationMaps", mapped);
    }
    if (index === 0) {
      const [sourceItem, targetItem] = await Promise.all([
        ctx.db
          .query("irtScaleItems")
          .withIndex("by_scaleVersionId_and_placementIdentity", (query) =>
            query.eq("scaleVersionId", cleanup.sourceScale.scaleVersionId)
          )
          .unique(),
        ctx.db
          .query("irtScaleItems")
          .withIndex("by_scaleVersionId_and_placementIdentity", (query) =>
            query.eq("scaleVersionId", cleanup.targetScaleId)
          )
          .unique(),
      ]);
      assert.ok(sourceItem && targetItem);
      await ctx.db.patch(sourceItem._id, {
        placementIdentity: mapped.identity,
        placementRowHash: mapped.oldHash,
      });
      await ctx.db.patch(targetItem._id, {
        placementIdentity: mapped.identity,
        placementRowHash: mapped.newHash,
      });
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
        placementRowHash: row.retained.record.rowHash,
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
    await seedRepairSource(ctx, cleanup, source);
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
