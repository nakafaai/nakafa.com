import { describe, expect, it } from "@effect/vitest";
import { SignedTryoutHistoryMigrationReceiptSchema } from "@nakafa/aksara-contracts/migration/tryout/history/spec";
import { ContentVerificationKeyResolver } from "@nakafa/aksara-contracts/signature/spec";
import { contentKeyResolver } from "@repo/backend/content/trust";
import { recordPredecessorRead } from "@repo/backend/convex/contentRelease/predecessor/record";
import { retireRuntimeState } from "@repo/backend/convex/contentRelease/retire/impl";
import type { RetirementRuntimeContract } from "@repo/backend/convex/contentRelease/retire/runtime";
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
import {
  seedRetirementRuntime,
  TEST_LEGACY_BUNDLE_COUNT,
} from "@repo/backend/test/runtime/retirement";
import type { TestConvex } from "convex-test";
import { convexTest } from "convex-test";
import { Effect, Schema } from "effect";

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
const EMPTY_TERMINAL_STATE = {
  legacyBundleCount: 0,
  observerCount: 0,
  observerPhases: [],
  receiptCount: 0,
  repairPresent: false,
} as const;
const RETAINED_TERMINAL_STATE = {
  legacyBundleCount: TEST_LEGACY_BUNDLE_COUNT,
  observerCount: 4,
  observerPhases: ["armed", "armed", "armed", "armed"],
  receiptCount: 1,
  repairPresent: true,
} as const;

type RetirementTest = TestConvex<typeof schema>;
interface RetirementProof {
  readonly assetHash: string;
  readonly sourceSha: string;
}

class TestMutationError extends Schema.TaggedError<TestMutationError>()(
  "TestMutationError",
  { cause: Schema.Unknown }
) {}

function expectIntegrityFailure(error: TestMutationError) {
  expect(error.cause).toMatchObject({
    data: { code: "CONTENT_RELEASE_INTEGRITY" },
  });
}

const seedCleanedReceipt = Effect.fn("test.retire.seedReceipt")(function* (
  target: RetirementTest
) {
  const signed = RETIREMENT_RECEIPT.payload.completion;
  const completion = {
    cleanupLimit: signed.cleanupLimit,
    completedAt: signed.completedAt,
    migratedAttempts: signed.migratedAttempts,
    migratedScaleItems: signed.migratedScaleItems,
    migratedScaleRuns: signed.migratedScaleRuns,
    migratedScaleVersions: signed.migratedScaleVersions,
  };
  yield* Effect.promise(() =>
    target.mutation((ctx) =>
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
    )
  );
});

const seedTerminalState = Effect.fn("test.retire.seedState")(function* (
  target: RetirementTest
) {
  yield* Effect.promise(() => seedPredecessorObservation(target));
  yield* seedCleanedReceipt(target);
  return (yield* seedRetirementRuntime(target)).contract;
});

const runRetirement = Effect.fn("test.retire.run")(function* (
  target: RetirementTest,
  runtimeContract: RetirementRuntimeContract,
  receiptJson = RETIREMENT_RECEIPT_JSON,
  proof: RetirementProof = RETIREMENT_PROOF
) {
  return yield* Effect.tryPromise({
    try: () =>
      target.mutation((ctx) =>
        runConvexProgram(
          retireRuntimeState(
            ctx,
            PREDECESSOR_OBSERVATION_ID,
            receiptJson,
            proof,
            runtimeContract
          ).pipe(
            Effect.provideService(
              ContentVerificationKeyResolver,
              contentKeyResolver
            )
          )
        )
      ),
    catch: (cause) => new TestMutationError({ cause }),
  });
});

const readTerminalState = Effect.fn("test.retire.readState")(function* (
  target: RetirementTest
) {
  return yield* Effect.promise(() =>
    target.run((ctx) =>
      runConvexProgram(
        Effect.all({
          legacyBundles: Effect.promise(() =>
            ctx.db.query("tryoutBundles").collect()
          ),
          observers: Effect.promise(() =>
            ctx.db.query("contentPredecessorReads").collect()
          ),
          receipts: Effect.promise(() =>
            ctx.db.query("tryoutHistoryMigrationReceipts").collect()
          ),
        }).pipe(
          Effect.map(({ legacyBundles, observers, receipts }) => ({
            legacyBundleCount: legacyBundles.length,
            observerCount: observers.length,
            observerPhases: observers.map(({ phase }) => phase),
            receiptCount: receipts.length,
            repairPresent: receipts[0]?.repair !== undefined,
          }))
        )
      )
    )
  );
});

describe("contentRelease/retire", () => {
  it.effect(
    "atomically retires all terminal rows and accepts an exact retry",
    () =>
      Effect.gen(function* () {
        const target = convexTest(schema, convexModules);
        const runtimeContract = yield* seedTerminalState(target);

        expect(yield* runRetirement(target, runtimeContract)).toMatchObject({
          deleted: 5 + TEST_LEGACY_BUNDLE_COUNT,
          deletedLegacyBundles: TEST_LEGACY_BUNDLE_COUNT,
          migrationId: RETIREMENT_RECEIPT.payload.migrationId,
          observationId: PREDECESSOR_OBSERVATION_ID,
          permanentAttempts: 1,
          receiptHash: RETIREMENT_RECEIPT.receiptHash,
        });
        expect(yield* readTerminalState(target)).toEqual(EMPTY_TERMINAL_STATE);
        expect(yield* runRetirement(target, runtimeContract)).toMatchObject({
          deleted: 0,
          deletedLegacyBundles: 0,
        });
      })
  );

  it.effect("rejects a terminal retry with a different source commit", () =>
    Effect.gen(function* () {
      const target = convexTest(schema, convexModules);
      const runtimeContract = yield* seedTerminalState(target);
      expect(yield* runRetirement(target, runtimeContract)).toMatchObject({
        deleted: 5 + TEST_LEGACY_BUNDLE_COUNT,
      });

      expectIntegrityFailure(
        yield* runRetirement(target, runtimeContract, RETIREMENT_RECEIPT_JSON, {
          ...RETIREMENT_PROOF,
          sourceSha: "f".repeat(40),
        }).pipe(Effect.flip)
      );
    })
  );

  it.effect("rejects any predecessor call without deleting evidence", () =>
    Effect.gen(function* () {
      const target = convexTest(schema, convexModules);
      const runtimeContract = yield* seedTerminalState(target);
      yield* Effect.promise(() =>
        target.mutation((ctx) =>
          runConvexProgram(recordPredecessorRead(ctx, "protected"))
        )
      );

      const error = yield* runRetirement(target, runtimeContract).pipe(
        Effect.flip
      );
      expect(error.cause).toMatchObject({
        data: { code: "CONTENT_RELEASE_STATE" },
      });
      expect(yield* readTerminalState(target)).toEqual(RETAINED_TERMINAL_STATE);
    })
  );

  it.effect("rejects a missing repair audit without deleting evidence", () =>
    Effect.gen(function* () {
      const target = convexTest(schema, convexModules);
      const runtimeContract = yield* seedTerminalState(target);
      yield* Effect.promise(() =>
        target.mutation((ctx) =>
          runConvexProgram(
            Effect.gen(function* () {
              const receipt = yield* Effect.promise(() =>
                ctx.db.query("tryoutHistoryMigrationReceipts").unique()
              );
              expect(receipt).not.toBeNull();
              if (receipt) {
                yield* Effect.promise(() =>
                  ctx.db.patch(receipt._id, { repair: undefined })
                );
              }
            })
          )
        )
      );

      expectIntegrityFailure(
        yield* runRetirement(target, runtimeContract).pipe(Effect.flip)
      );
      expect(yield* readTerminalState(target)).toEqual({
        ...RETAINED_TERMINAL_STATE,
        repairPresent: false,
      });
    })
  );

  it.effect("rejects noncanonical receipt without deleting evidence", () =>
    Effect.gen(function* () {
      const target = convexTest(schema, convexModules);
      const runtimeContract = yield* seedTerminalState(target);
      const noncanonicalReceipt = JSON.stringify(
        PARSED_RETIREMENT_RECEIPT,
        undefined,
        2
      );

      expectIntegrityFailure(
        yield* runRetirement(target, runtimeContract, noncanonicalReceipt).pipe(
          Effect.flip
        )
      );
      expect(yield* readTerminalState(target)).toEqual(RETAINED_TERMINAL_STATE);
    })
  );

  it.effect("rejects partial terminal state after receipt loss", () =>
    Effect.gen(function* () {
      const target = convexTest(schema, convexModules);
      const runtimeContract = yield* seedTerminalState(target);
      yield* Effect.promise(() =>
        target.mutation((ctx) =>
          runConvexProgram(
            Effect.gen(function* () {
              const receipt = yield* Effect.promise(() =>
                ctx.db.query("tryoutHistoryMigrationReceipts").unique()
              );
              expect(receipt).not.toBeNull();
              if (receipt) {
                yield* Effect.promise(() => ctx.db.delete(receipt._id));
              }
            })
          )
        )
      );

      expectIntegrityFailure(
        yield* runRetirement(target, runtimeContract).pipe(Effect.flip)
      );
      expect(yield* readTerminalState(target)).toEqual({
        ...EMPTY_TERMINAL_STATE,
        legacyBundleCount: TEST_LEGACY_BUNDLE_COUNT,
        observerCount: 4,
        observerPhases: RETAINED_TERMINAL_STATE.observerPhases,
      });
    })
  );

  it.effect("rejects migration remnants without deleting evidence", () =>
    Effect.gen(function* () {
      const target = convexTest(schema, convexModules);
      const runtimeContract = yield* seedTerminalState(target);
      yield* Effect.promise(() =>
        target.mutation((ctx) =>
          ctx.db.insert("tryoutHistoryMigrationAborts", {
            abortedAt: 1,
            deleted: 1,
            migrationId: "unexpected-migration",
            sourceSnapshotId: `sha256:${"f".repeat(64)}`,
          })
        )
      );

      expectIntegrityFailure(
        yield* runRetirement(target, runtimeContract).pipe(Effect.flip)
      );
      expect(yield* readTerminalState(target)).toEqual(RETAINED_TERMINAL_STATE);
    })
  );
});
