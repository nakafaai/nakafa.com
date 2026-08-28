import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "@effect/vitest";
import { SignedTryoutHistoryMigrationReceiptSchema } from "@nakafa/aksara-contracts/migration/tryout/history/spec";
import { internal } from "@repo/backend/convex/_generated/api";
import { sealPredecessorObservation } from "@repo/backend/convex/contentRelease/predecessor/control";
import { recordPredecessorRead } from "@repo/backend/convex/contentRelease/predecessor/record";
import { PREDECESSOR_QUIET_WINDOW_MS } from "@repo/backend/convex/contentRelease/predecessor/spec";
import { runConvexProgram } from "@repo/backend/convex/lib/effect";
import schema from "@repo/backend/convex/schema";
import { convexModules } from "@repo/backend/convex/test.setup";
import {
  countScaleRepairRows,
  retainedScaleRepair,
} from "@repo/backend/convex/tryouts/migration/cleanup/evidence";
import {
  PREDECESSOR_OBSERVATION_ID,
  seedPredecessorObservation,
} from "@repo/backend/test/predecessor";
import type { TestConvex } from "convex-test";
import { convexTest } from "convex-test";
import { Schema } from "effect";

const RETIREMENT_RECEIPT_JSON =
  '{"keyId":"content-2026-07-23","payload":{"completion":{"cleanupLimit":6548,"completedAt":1787910534983,"migratedAttempts":21,"migratedScaleItems":450,"migratedScaleRuns":21,"migratedScaleVersions":3,"remainingMarkers":0},"format":"signed-tryout-history-migration-receipt","migrationId":"retained-tryout-history","planHash":"sha256:9ac40883fe6c7856a4f69e492513229d4dc4596df12d78bfc7a7c9fe182c81f9","sourceSnapshotId":"sha256:0a43a4125fc4886f90b5a509405178bfb8762ad3c7f72be80614fce2671b5162","targetBundleHash":"sha256:58f26a6cfcf0b4632453fb5d8e66725cc8f7797e04ee0eb393044421b3b4a1bf","targetSnapshotId":"sha256:83d2c8ff4fbfa56bc98e90007906f8dd06495a917a32cfd622f90471f3c0afc5"},"receiptHash":"sha256:42e30eff6c16e14ba86bb44ff85be2b621fab1b2749440e647d7b71a67b47649","signature":"VD1p9541sfW3qsQs8TdJn9NumujNYBEcRXA2eGZNdSrOaMiNDQYP6mU8crYnyEC_neYOWp_6u5ycmDKhlJ2KCA"}';
const RETIREMENT_PROOF = {
  assetHash:
    "sha256:2e0e31ea0733fc7945d9e05c91d9e012c477ce7fb5bd958245e744ae4eab14ba",
  sourceSha: "5ff4bbffe406ea020a741ffa794bc4ff5d9353e0",
} as const;
const PARSED_RETIREMENT_RECEIPT: unknown = JSON.parse(RETIREMENT_RECEIPT_JSON);
const RETIREMENT_RECEIPT = Schema.decodeUnknownSync(
  SignedTryoutHistoryMigrationReceiptSchema,
  { onExcessProperty: "error" }
)(PARSED_RETIREMENT_RECEIPT);
const RETIREMENT_TIME = Date.UTC(2026, 7, 30, 8);
const retire = internal.contentRelease.retire.retire;

type RetirementTest = TestConvex<typeof schema>;

async function seedCleanedReceipt(target: RetirementTest) {
  const signed = RETIREMENT_RECEIPT.payload.completion;
  const completion = {
    cleanupLimit: signed.cleanupLimit,
    completedAt: signed.completedAt,
    migratedAttempts: signed.migratedAttempts,
    migratedScaleItems: signed.migratedScaleItems,
    migratedScaleRuns: signed.migratedScaleRuns,
    migratedScaleVersions: signed.migratedScaleVersions,
  };
  await target.mutation((ctx) =>
    ctx.db.insert("tryoutHistoryMigrationReceipts", {
      ...completion,
      deletedRows: 1,
      migrationId: RETIREMENT_RECEIPT.payload.migrationId,
      phase: "cleaned",
      planHash: RETIREMENT_RECEIPT.payload.planHash,
      proof: RETIREMENT_PROOF,
      receiptHash: RETIREMENT_RECEIPT.receiptHash,
      receiptJson: RETIREMENT_RECEIPT_JSON,
      recordedAt: 1,
      repair: {
        ...retainedScaleRepair,
        deletedRows: countScaleRepairRows(retainedScaleRepair),
        repairedAt: 1,
        runCount: retainedScaleRepair.runs.length,
        runs: [...retainedScaleRepair.runs],
      },
      sourceSnapshotId: RETIREMENT_RECEIPT.payload.sourceSnapshotId,
      targetBundleHash: RETIREMENT_RECEIPT.payload.targetBundleHash,
      targetSnapshotId: RETIREMENT_RECEIPT.payload.targetSnapshotId,
    })
  );
}

async function seedTerminalState(target: RetirementTest) {
  vi.setSystemTime(RETIREMENT_TIME);
  await seedPredecessorObservation(target);
  await seedCleanedReceipt(target);
  vi.setSystemTime(RETIREMENT_TIME + PREDECESSOR_QUIET_WINDOW_MS);
  await target.mutation((ctx) =>
    runConvexProgram(
      sealPredecessorObservation(ctx, PREDECESSOR_OBSERVATION_ID)
    )
  );
}

function runRetirement(
  target: RetirementTest,
  receiptJson = RETIREMENT_RECEIPT_JSON
) {
  return target.mutation(retire, {
    observationId: PREDECESSOR_OBSERVATION_ID,
    proof: RETIREMENT_PROOF,
    receiptJson,
  });
}

function readTerminalState(target: RetirementTest) {
  return target.run(async (ctx) => {
    const observers = await ctx.db.query("contentPredecessorReads").collect();
    const receipts = await ctx.db
      .query("tryoutHistoryMigrationReceipts")
      .collect();
    return {
      observerCount: observers.length,
      observerPhases: observers.map(({ phase }) => phase),
      receiptCount: receipts.length,
      repairPresent: receipts[0]?.repair !== undefined,
    };
  });
}

describe("contentRelease/retire", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("atomically retires five rows and accepts an exact retry", async () => {
    const target = convexTest(schema, convexModules);
    await seedTerminalState(target);

    await expect(runRetirement(target)).resolves.toMatchObject({
      deleted: 5,
      migrationId: RETIREMENT_RECEIPT.payload.migrationId,
      observationId: PREDECESSOR_OBSERVATION_ID,
      receiptHash: RETIREMENT_RECEIPT.receiptHash,
    });
    await expect(readTerminalState(target)).resolves.toEqual({
      observerCount: 0,
      observerPhases: [],
      receiptCount: 0,
      repairPresent: false,
    });
    await expect(runRetirement(target)).resolves.toMatchObject({ deleted: 0 });
  });

  it("rejects a late predecessor call without deleting evidence", async () => {
    const target = convexTest(schema, convexModules);
    await seedTerminalState(target);
    vi.setSystemTime(RETIREMENT_TIME + PREDECESSOR_QUIET_WINDOW_MS + 1);
    await target.mutation((ctx) =>
      runConvexProgram(recordPredecessorRead(ctx, "protected"))
    );

    await expect(runRetirement(target)).rejects.toMatchObject({
      data: { code: "CONTENT_RELEASE_STATE" },
    });
    await expect(readTerminalState(target)).resolves.toEqual({
      observerCount: 4,
      observerPhases: ["armed", "armed", "armed", "armed"],
      receiptCount: 1,
      repairPresent: true,
    });
  });

  it("rejects a missing repair audit without deleting evidence", async () => {
    const target = convexTest(schema, convexModules);
    await seedTerminalState(target);
    await target.mutation(async (ctx) => {
      const receipt = await ctx.db
        .query("tryoutHistoryMigrationReceipts")
        .unique();
      expect(receipt).not.toBeNull();
      if (receipt) {
        await ctx.db.patch(receipt._id, { repair: undefined });
      }
    });

    await expect(runRetirement(target)).rejects.toMatchObject({
      data: { code: "CONTENT_RELEASE_INTEGRITY" },
    });
    await expect(readTerminalState(target)).resolves.toEqual({
      observerCount: 4,
      observerPhases: ["sealed", "sealed", "sealed", "sealed"],
      receiptCount: 1,
      repairPresent: false,
    });
  });

  it("rejects noncanonical signed receipt bytes without deleting evidence", async () => {
    const target = convexTest(schema, convexModules);
    await seedTerminalState(target);
    const noncanonicalReceipt = JSON.stringify(
      PARSED_RETIREMENT_RECEIPT,
      undefined,
      2
    );

    await expect(
      runRetirement(target, noncanonicalReceipt)
    ).rejects.toMatchObject({
      data: { code: "CONTENT_RELEASE_INTEGRITY" },
    });
    await expect(readTerminalState(target)).resolves.toEqual({
      observerCount: 4,
      observerPhases: ["sealed", "sealed", "sealed", "sealed"],
      receiptCount: 1,
      repairPresent: true,
    });
  });

  it("rejects partial terminal state after receipt loss", async () => {
    const target = convexTest(schema, convexModules);
    await seedTerminalState(target);
    await target.mutation(async (ctx) => {
      const receipt = await ctx.db
        .query("tryoutHistoryMigrationReceipts")
        .unique();
      expect(receipt).not.toBeNull();
      if (receipt) {
        await ctx.db.delete(receipt._id);
      }
    });

    await expect(runRetirement(target)).rejects.toMatchObject({
      data: { code: "CONTENT_RELEASE_INTEGRITY" },
    });
    await expect(readTerminalState(target)).resolves.toEqual({
      observerCount: 4,
      observerPhases: ["sealed", "sealed", "sealed", "sealed"],
      receiptCount: 0,
      repairPresent: false,
    });
  });

  it("rejects any remaining migration row without deleting evidence", async () => {
    const target = convexTest(schema, convexModules);
    await seedTerminalState(target);
    await target.mutation((ctx) =>
      ctx.db.insert("tryoutHistoryMigrationAborts", {
        abortedAt: 1,
        deleted: 1,
        migrationId: "unexpected-migration",
        sourceSnapshotId: `sha256:${"f".repeat(64)}`,
      })
    );

    await expect(runRetirement(target)).rejects.toMatchObject({
      data: { code: "CONTENT_RELEASE_INTEGRITY" },
    });
    await expect(readTerminalState(target)).resolves.toEqual({
      observerCount: 4,
      observerPhases: ["sealed", "sealed", "sealed", "sealed"],
      receiptCount: 1,
      repairPresent: true,
    });
  });
});
