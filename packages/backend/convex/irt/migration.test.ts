import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import {
  type IrtIdentityMigrationArgs,
  type IrtIdentityMigrationReceipt,
  type IrtIdentityPhase,
  irtIdentityPageSize,
  migrateIrtIdentity,
  validateIrtIdentityBounds,
} from "@repo/backend/convex/irt/migration";
import { runConvexProgram } from "@repo/backend/convex/lib/effect";
import schema from "@repo/backend/convex/schema";
import { convexModules } from "@repo/backend/convex/test.setup";
import {
  liveIrtCounts,
  seedLiveIrtMigration,
} from "@repo/backend/test/irt-migration";
import { activateTryoutIdentitySnapshot } from "@repo/backend/test/tryout-identity";
import {
  insertTryoutQuestionSource,
  insertTryoutSection,
  insertTryoutSet,
  TRYOUT_SECTION_PATH,
} from "@repo/backend/test/tryouts";
import type { TestConvex } from "convex-test";
import { convexTest } from "convex-test";
import { Effect } from "effect";
import { describe, expect, it } from "vitest";

const SNAPSHOT_ID = `sha256:${"7".repeat(64)}`;

/** Inserts the exact legacy and immutable rows used by migration tests. */
async function seedIdentityGraph(ctx: MutationCtx) {
  const snapshotId = await activateTryoutIdentitySnapshot(ctx);
  const tryoutSetId = await insertTryoutSet(ctx);
  const questionSetId = await insertTryoutQuestionSource(ctx);
  const tryoutSectionId = await insertTryoutSection(ctx, {
    publicPath: TRYOUT_SECTION_PATH,
    questionSetId,
    tryoutSetId,
  });
  const question = await ctx.db.query("questions").unique();
  if (!question) {
    throw new Error("Expected one legacy IRT question.");
  }

  const scaleVersionId = await ctx.db.insert("irtScaleVersions", {
    model: "2pl",
    publishedAt: 1,
    questionCount: 1,
    status: "provisional",
    tryoutSetId,
  });
  const calibrationRunId = await ctx.db.insert("irtCalibrationRuns", {
    attemptCount: 0,
    completedAt: 1,
    iterationCount: 0,
    maxParameterDelta: 0,
    model: "2pl",
    questionCount: 1,
    responseCount: 0,
    startedAt: 1,
    status: "completed",
    tryoutSectionId,
    updatedAt: 1,
  });
  const itemId = await ctx.db.insert("irtScaleItems", {
    calibrationRunId,
    calibrationStatus: "provisional",
    contentHash: question.contentHash,
    correctRate: 0,
    difficulty: 0,
    discrimination: 1,
    questionId: question._id,
    questionSourceKey: question.sourceKey,
    responseCount: 0,
    scaleVersionId,
    sourceRevision: question.sourceRevision,
  });
  return { calibrationRunId, itemId, scaleVersionId, snapshotId };
}

/** Creates one exact migration request for a verified snapshot. */
function migrationArgs(
  snapshotId: string,
  phase: IrtIdentityPhase = "scales"
): IrtIdentityMigrationArgs {
  return {
    apply: false,
    expectedItemCount: 1,
    expectedRunCount: 1,
    expectedScaleCount: 1,
    paginationOpts: { cursor: null, numItems: irtIdentityPageSize },
    phase,
    snapshotId,
  };
}

/** Runs every stable cursor page for one exact IRT migration phase. */
async function runPhase(
  t: TestConvex<typeof schema>,
  input: Omit<IrtIdentityMigrationArgs, "apply" | "paginationOpts">,
  apply: boolean
) {
  const receipts: IrtIdentityMigrationReceipt[] = [];
  let cursor: string | null = null;
  do {
    const receipt = await t.mutation((ctx) =>
      runConvexProgram(
        migrateIrtIdentity(ctx, {
          ...input,
          apply,
          paginationOpts: { cursor, numItems: irtIdentityPageSize },
        })
      )
    );
    receipts.push(receipt);
    cursor = receipt.continueCursor;
  } while (!receipts.at(-1)?.isDone);
  return receipts;
}

/** Sums one numeric receipt field without hiding individual page evidence. */
function receiptTotal(
  receipts: readonly IrtIdentityMigrationReceipt[],
  field: "candidates" | "processed" | "updated"
) {
  return receipts.reduce((sum, receipt) => sum + receipt[field], 0);
}

describe("irt identity migration", () => {
  it("accepts the exact observed live bounds and rejects unsafe counts", async () => {
    await expect(
      Effect.runPromise(
        validateIrtIdentityBounds({
          apply: false,
          expectedItemCount: 600,
          expectedRunCount: 28,
          expectedScaleCount: 4,
          paginationOpts: {
            cursor: null,
            numItems: irtIdentityPageSize,
          },
          phase: "items",
          snapshotId: SNAPSHOT_ID,
        })
      )
    ).resolves.toBeUndefined();
    const failure = await Effect.runPromise(
      Effect.flip(
        validateIrtIdentityBounds({
          ...migrationArgs(SNAPSHOT_ID),
          expectedItemCount: 1001,
        })
      )
    );
    expect(failure).toMatchObject({ code: "IRT_IDENTITY_MIGRATION" });
    const invalidSnapshot = await Effect.runPromise(
      Effect.flip(
        validateIrtIdentityBounds({
          ...migrationArgs(SNAPSHOT_ID),
          snapshotId: "invalid",
        })
      )
    );
    expect(invalidSnapshot).toMatchObject({ code: "IRT_IDENTITY_MIGRATION" });
    const invalidPage = await Effect.runPromise(
      Effect.flip(
        validateIrtIdentityBounds({
          ...migrationArgs(SNAPSHOT_ID),
          paginationOpts: { cursor: null, numItems: irtIdentityPageSize + 1 },
        })
      )
    );
    expect(invalidPage).toMatchObject({ code: "IRT_IDENTITY_MIGRATION" });
  });

  it("orders, previews, applies, and idempotently verifies each phase", async () => {
    const t = convexTest(schema, convexModules);
    const ids = await t.mutation(seedIdentityGraph);
    await expect(
      runPhase(t, migrationArgs(ids.snapshotId, "runs"), false)
    ).rejects.toMatchObject({
      data: { code: "IRT_IDENTITY_MIGRATION" },
    });
    for (const phase of ["scales", "runs", "items"] as const) {
      const input = migrationArgs(ids.snapshotId, phase);
      const preview = await runPhase(t, input, false);
      expect(preview).toHaveLength(1);
      expect(preview[0]).toMatchObject({
        applied: false,
        candidates: 1,
        pending: 1,
        phase,
        processed: 1,
        remaining: 1,
        updated: 0,
      });
      const applied = await runPhase(t, input, true);
      expect(applied[0]).toMatchObject({
        applied: true,
        candidates: 1,
        pending: 1,
        remaining: 0,
        updated: 1,
      });
      const repeated = await runPhase(t, input, true);
      expect(repeated[0]).toMatchObject({
        candidates: 0,
        pending: 0,
        remaining: 0,
        updated: 0,
      });
      if (phase === "scales") {
        await expect(
          runPhase(t, migrationArgs(ids.snapshotId, "items"), false)
        ).rejects.toMatchObject({
          data: { code: "IRT_IDENTITY_MIGRATION" },
        });
      }
    }
  });

  it("migrates the observed 4-scale, 28-run, 600-item graph in pages", async () => {
    const t = convexTest(schema, convexModules);
    const snapshotId = await t.mutation(seedLiveIrtMigration);
    for (const [phase, count, pageCount] of [
      ["scales", liveIrtCounts.scales, 1],
      ["runs", liveIrtCounts.runs, 1],
      ["items", liveIrtCounts.items, 12],
    ] as const) {
      const input = {
        ...migrationArgs(snapshotId, phase),
        expectedItemCount: liveIrtCounts.items,
        expectedRunCount: liveIrtCounts.runs,
        expectedScaleCount: liveIrtCounts.scales,
      };
      const applied = await runPhase(t, input, true);
      expect(applied).toHaveLength(pageCount);
      expect(receiptTotal(applied, "processed")).toBe(count);
      expect(receiptTotal(applied, "candidates")).toBe(count);
      expect(receiptTotal(applied, "updated")).toBe(count);
      expect(applied.at(-1)).toMatchObject({ isDone: true, remaining: 0 });

      const repeated = await runPhase(t, input, true);
      expect(repeated).toHaveLength(pageCount);
      expect(receiptTotal(repeated, "processed")).toBe(count);
      expect(receiptTotal(repeated, "candidates")).toBe(0);
      expect(receiptTotal(repeated, "updated")).toBe(0);
    }
  });

  it("fails before writes when exact counts or stable values disagree", async () => {
    const t = convexTest(schema, convexModules);
    const ids = await t.mutation(seedIdentityGraph);
    const args = migrationArgs(ids.snapshotId);
    await expect(
      t.mutation((ctx) =>
        runConvexProgram(migrateIrtIdentity(ctx, migrationArgs(SNAPSHOT_ID)))
      )
    ).rejects.toMatchObject({
      data: { code: "IRT_IDENTITY_MIGRATION" },
    });
    await expect(
      t.mutation((ctx) =>
        runConvexProgram(
          migrateIrtIdentity(ctx, {
            ...args,
            apply: true,
            expectedItemCount: 2,
          })
        )
      )
    ).rejects.toMatchObject({
      data: { code: "IRT_IDENTITY_MIGRATION" },
    });
    await t.mutation((ctx) =>
      ctx.db.patch("irtScaleVersions", ids.scaleVersionId, {
        setIdentity: "conflict",
      })
    );
    await expect(
      t.mutation((ctx) =>
        runConvexProgram(migrateIrtIdentity(ctx, { ...args, apply: true }))
      )
    ).rejects.toMatchObject({
      data: { code: "IRT_IDENTITY_MIGRATION" },
    });
    const item = await t.run((ctx) => ctx.db.get(ids.itemId));
    expect(item).not.toHaveProperty("placementIdentity");
    expect(item).not.toHaveProperty("placementRowHash");
  });
});
