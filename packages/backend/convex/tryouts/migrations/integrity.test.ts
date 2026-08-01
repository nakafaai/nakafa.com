import { internal } from "@repo/backend/convex/_generated/api";
import type schema from "@repo/backend/convex/schema";
import { createConvexTestWithBetterAuth } from "@repo/backend/convex/test.helpers";
import {
  makeTryoutMigrationArgs,
  seedTryoutMigration,
  TRYOUT_MIGRATION_COUNTS,
} from "@repo/backend/test/tryout-migration";
import type { FunctionArgs, FunctionReturnType } from "convex/server";
import type { TestConvex } from "convex-test";
import { describe, expect, it } from "vitest";

/** Runs every migration capability in dependency order. */
async function migrateAll(
  t: TestConvex<typeof schema>,
  snapshotId: string,
  apply = true
) {
  const args = makeTryoutMigrationArgs(snapshotId, apply);
  const attempts = await t.mutation(
    internal.tryouts.migrations.attempt.migrateAttempts,
    args
  );
  const progress = await t.mutation(
    internal.tryouts.migrations.progress.migrateProgress,
    args
  );
  const sections = await t.mutation(
    internal.tryouts.migrations.progress.migrateSections,
    args
  );
  const placements = await t.mutation(
    internal.tryouts.migrations.placement.migratePlacements,
    args
  );
  const scores = await t.mutation(
    internal.tryouts.migrations.score.migrateScores,
    args
  );
  const items = await t.mutation(
    internal.tryouts.migrations.item.migrateItems,
    args
  );
  const runs = await t.mutation(
    internal.tryouts.migrations.calibration.migrateRuns,
    args
  );
  const scales = await t.mutation(
    internal.tryouts.migrations.scale.migrateScales,
    args
  );
  return [
    attempts,
    progress,
    sections,
    placements,
    scores,
    scales,
    runs,
    items,
  ];
}

type InspectArgs = FunctionArgs<
  typeof internal.tryouts.migrations.integrity.inspect
>;
type InspectResult = FunctionReturnType<
  typeof internal.tryouts.migrations.integrity.inspect
>;

/** Reads every cursor for one exact integrity surface. */
async function inspectTable(
  t: TestConvex<typeof schema>,
  snapshotId: string,
  table: InspectArgs["table"],
  expectedTotal: number
) {
  let cursor: string | null = null;
  let legacy = 0;
  let prepared = 0;
  let processed = 0;
  while (true) {
    const page: InspectResult = await t.query(
      internal.tryouts.migrations.integrity.inspect,
      {
        expectedProcessed: processed,
        expectedSnapshotId: snapshotId,
        expectedTotal,
        paginationOpts: { cursor, numItems: 50 },
        table,
      }
    );
    legacy += page.legacy;
    prepared += page.prepared;
    processed = page.processed;
    if (page.isDone) {
      return { legacy, prepared, total: processed };
    }
    cursor = page.continueCursor;
  }
}

/** Reads exact paginated integrity evidence for the technical graph. */
async function inspectMigration(
  t: TestConvex<typeof schema>,
  snapshotId: string
) {
  const [
    attempts,
    calibrationRuns,
    irtItems,
    placements,
    progress,
    responses,
    scaleVersions,
    scores,
    sectionAttempts,
  ] = await Promise.all([
    inspectTable(t, snapshotId, "attempts", TRYOUT_MIGRATION_COUNTS.attempts),
    inspectTable(
      t,
      snapshotId,
      "calibrationRuns",
      TRYOUT_MIGRATION_COUNTS.calibrationRuns
    ),
    inspectTable(t, snapshotId, "irtItems", TRYOUT_MIGRATION_COUNTS.irtItems),
    inspectTable(
      t,
      snapshotId,
      "placements",
      TRYOUT_MIGRATION_COUNTS.placements
    ),
    inspectTable(t, snapshotId, "progress", TRYOUT_MIGRATION_COUNTS.progress),
    inspectTable(t, snapshotId, "responses", TRYOUT_MIGRATION_COUNTS.responses),
    inspectTable(
      t,
      snapshotId,
      "scaleVersions",
      TRYOUT_MIGRATION_COUNTS.scaleVersions
    ),
    inspectTable(t, snapshotId, "scores", TRYOUT_MIGRATION_COUNTS.scores),
    inspectTable(
      t,
      snapshotId,
      "sectionAttempts",
      TRYOUT_MIGRATION_COUNTS.sectionAttempts
    ),
  ]);
  await t.query(internal.tryouts.migrations.integrity.inspectEmpty, {});
  return {
    attempts,
    calibrationRuns,
    irtItems,
    placements,
    progress,
    responses,
    scaleVersions,
    scores,
    sectionAttempts,
  };
}

describe("tryouts/migrations/integrity", () => {
  it("prepares, verifies, and idempotently rechecks every row", async () => {
    const t = createConvexTestWithBetterAuth();
    const { placementId, snapshotId } = await t.mutation(seedTryoutMigration);

    const preview = await t.mutation(
      internal.tryouts.migrations.attempt.migrateAttempts,
      makeTryoutMigrationArgs(snapshotId, false)
    );
    expect(preview).toMatchObject({ changed: 1, isDone: true, scanned: 1 });

    await migrateAll(t, snapshotId);
    await expect(
      t.run((ctx) => ctx.db.get(placementId))
    ).resolves.toMatchObject({
      sourcePath:
        "question-bank/tryout/indonesia/snbt/quantitative-knowledge/set-1/question-1",
    });
    await expect(
      t.run((ctx) => ctx.db.query("tryoutAttempts").unique())
    ).resolves.toMatchObject({
      sectionSnapshots: [
        {
          questionSourcePath:
            "question-bank/tryout/indonesia/snbt/quantitative-knowledge/set-1",
          sourceRevision: "2026",
        },
      ],
    });
    await expect(inspectMigration(t, snapshotId)).resolves.toMatchObject({
      attempts: { legacy: 1, prepared: 1, total: 1 },
      calibrationRuns: { legacy: 1, prepared: 1, total: 1 },
      irtItems: { legacy: 1, prepared: 1, total: 1 },
      placements: { legacy: 1, prepared: 1, total: 1 },
      progress: { legacy: 1, prepared: 1, total: 1 },
      responses: { legacy: 1, prepared: 1, total: 1 },
      scaleVersions: { legacy: 1, prepared: 1, total: 1 },
      scores: { legacy: 1, prepared: 1, total: 1 },
      sectionAttempts: { legacy: 1, prepared: 1, total: 1 },
    });

    const repeated = await migrateAll(t, snapshotId);
    expect(repeated.every(({ changed }) => changed === 0)).toBe(true);
  });

  it("rejects stale snapshots and unexpected table counts before writes", async () => {
    const t = createConvexTestWithBetterAuth();
    const { snapshotId } = await t.mutation(seedTryoutMigration);

    await expect(
      t.mutation(internal.tryouts.migrations.attempt.migrateAttempts, {
        ...makeTryoutMigrationArgs(snapshotId),
        expectedTotal: 2,
      })
    ).rejects.toThrow("tryoutAttempts expected 2 rows but reached 1");
    await expect(
      t.mutation(
        internal.tryouts.migrations.progress.migrateProgress,
        makeTryoutMigrationArgs("stale-snapshot")
      )
    ).rejects.toThrow(
      "The active signed try-out snapshot does not match this migration"
    );
  });
});
