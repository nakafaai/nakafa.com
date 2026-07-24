import schema from "@repo/backend/convex/schema";
import { convexModules } from "@repo/backend/convex/test.setup";
import {
  migrateProgramIdentity,
  programMigrationArgs,
  seedProgramMigration,
  stageVerifiedPrograms,
} from "@repo/backend/test/program-migration";
import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";

describe("learningPrograms/migrations/identity", () => {
  it("backfills exact current and historical identities idempotently", async () => {
    const t = convexTest(schema, convexModules);
    const snapshotId = await stageVerifiedPrograms(t);
    const { orphanId } = await seedProgramMigration(t);

    for (const [table, missing] of [
      ["profiles", 2],
      ["plans", 2],
      ["items", 1],
      ["coverage", 1],
    ] as const) {
      const args = programMigrationArgs(snapshotId, orphanId, table, missing);
      await expect(t.mutation(migrateProgramIdentity, args)).resolves.toEqual({
        missing,
        remaining: missing,
        total: missing,
        updated: 0,
      });
      await expect(
        t.mutation(migrateProgramIdentity, { ...args, apply: true })
      ).resolves.toEqual({
        missing,
        remaining: 0,
        total: missing,
        updated: missing,
      });
      await expect(
        t.mutation(migrateProgramIdentity, {
          ...args,
          expectedMissing: 0,
        })
      ).resolves.toMatchObject({ missing: 0, remaining: 0, updated: 0 });
    }
  });

  it("resumes the observed 119-item table through repeated batches", async () => {
    const t = convexTest(schema, convexModules);
    const snapshotId = await stageVerifiedPrograms(t);
    const { orphanId } = await seedProgramMigration(t, 119);
    const args = programMigrationArgs(snapshotId, orphanId, "items", 119, 119);

    await expect(t.mutation(migrateProgramIdentity, args)).resolves.toEqual({
      missing: 119,
      remaining: 119,
      total: 119,
      updated: 0,
    });
    for (const [expectedMissing, updated, remaining] of [
      [119, 50, 69],
      [69, 50, 19],
      [19, 19, 0],
    ] as const) {
      await expect(
        t.mutation(migrateProgramIdentity, {
          ...args,
          apply: true,
          expectedMissing,
        })
      ).resolves.toEqual({
        missing: expectedMissing,
        remaining,
        total: 119,
        updated,
      });
    }
    await expect(
      t.mutation(migrateProgramIdentity, {
        ...args,
        apply: true,
        expectedMissing: 0,
      })
    ).resolves.toEqual({
      missing: 0,
      remaining: 0,
      total: 119,
      updated: 0,
    });
  });

  it("rejects wrong historical semantics and expected counts", async () => {
    const t = convexTest(schema, convexModules);
    const snapshotId = await stageVerifiedPrograms(t);
    const { currentPlanId, currentProfileId, orphanId, orphanPlanId } =
      await seedProgramMigration(t);
    const args = programMigrationArgs(snapshotId, orphanId, "profiles", 2);

    await expect(
      t.mutation(migrateProgramIdentity, {
        ...args,
        legacyMappings: [{ historicalKey: "snbt-2026", programId: orphanId }],
      })
    ).rejects.toThrow("LEARNING_PROGRAM_MIGRATION_RELATION");
    await expect(
      t.mutation(migrateProgramIdentity, {
        ...args,
        expected: { ...args.expected, plans: 3 },
      })
    ).rejects.toThrow("LEARNING_PROGRAM_MIGRATION_COUNT");
    await expect(
      t.mutation(migrateProgramIdentity, {
        ...args,
        expectedMissing: 1,
      })
    ).rejects.toThrow("LEARNING_PROGRAM_MIGRATION_COUNT");

    await t.mutation(async (ctx) => {
      await ctx.db.patch(currentPlanId, { status: "superseded" });
      await ctx.db.patch(currentProfileId, { activePlanId: orphanPlanId });
    });
    await expect(t.mutation(migrateProgramIdentity, args)).rejects.toThrow(
      "LEARNING_PROGRAM_MIGRATION_RELATION"
    );
  });
});
