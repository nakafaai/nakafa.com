import { assert, describe, it } from "@effect/vitest";
import { runConvexProgram } from "@repo/backend/convex/lib/effect";
import type schema from "@repo/backend/convex/schema";
import { createConvexTestWithBetterAuth } from "@repo/backend/convex/test.helpers";
import { cleanupProgram } from "@repo/backend/convex/tryouts/migration/cleanup/run";
import {
  seedCleanupGuard,
  seedCleanupSuccess,
} from "@repo/backend/test/migration/seed";
import {
  CLEANUP_LIMIT,
  CLEANUP_MIGRATION_ID,
  CLEANUP_PROOF,
  CLEANUP_RECEIPT_HASH,
  readCleanupResult,
  readCleanupState,
} from "@repo/backend/test/migration/state";
import type { TestConvex } from "convex-test";
import { Data, Effect } from "effect";

type CleanupTest = TestConvex<typeof schema>;

class CleanupFailure extends Data.TaggedError("CleanupFailure")<{
  readonly message: string;
}> {}

/** Runs one production cleanup transaction through the Convex Effect boundary. */
const runCleanup = Effect.fn("test.migration.runCleanup")(
  (t: CleanupTest, receiptHash = CLEANUP_RECEIPT_HASH, proof = CLEANUP_PROOF) =>
    Effect.tryPromise({
      catch: (cause) =>
        new CleanupFailure({
          message: cause instanceof Error ? cause.message : String(cause),
        }),
      try: () =>
        t.mutation((ctx) =>
          runConvexProgram(
            cleanupProgram(ctx, CLEANUP_MIGRATION_ID, receiptHash, proof)
          )
        ),
    })
);

describe("tryouts/migration/cleanup/run", () => {
  it.effect("rejects every destructive precondition before writes", () =>
    Effect.gen(function* () {
      const cases: readonly {
        readonly guard:
          | "attempt"
          | "marker"
          | "observer"
          | "observerId"
          | "receipt"
          | "reference"
          | "scaleAttempt"
          | "scaleScore";
        readonly message: string;
      }[] = [
        {
          guard: "receipt",
          message: "no matching permanent signed receipt",
        },
        { guard: "marker", message: "unmigrated attempt marker" },
        {
          guard: "observer",
          message: "must complete its observation window",
        },
        {
          guard: "observerId",
          message: "observation ID changed during migration",
        },
        {
          guard: "attempt",
          message: "attempt on the retained source snapshot",
        },
        {
          guard: "reference",
          message: "still protected from cleanup",
        },
        {
          guard: "scaleAttempt",
          message: "referenced by a try-out attempt or score",
        },
        {
          guard: "scaleScore",
          message: "referenced by a try-out attempt or score",
        },
      ];
      for (const { guard, message } of cases) {
        const t = createConvexTestWithBetterAuth();
        yield* Effect.promise(() => seedCleanupGuard(t, guard));
        const before = yield* Effect.promise(() => readCleanupState(t));
        const failure = yield* runCleanup(
          t,
          guard === "receipt" ? "another-receipt" : CLEANUP_RECEIPT_HASH
        ).pipe(Effect.flip);
        const after = yield* Effect.promise(() => readCleanupState(t));

        assert.ok(failure.message.includes(message));
        assert.deepStrictEqual(after, before);
      }
    })
  );

  it.effect("rejects a sealed receipt whose temporary root disappeared", () =>
    Effect.gen(function* () {
      const t = createConvexTestWithBetterAuth();
      yield* Effect.promise(() => seedCleanupGuard(t, "marker"));
      yield* Effect.promise(() =>
        t.mutation(async (ctx) => {
          const migration = await ctx.db
            .query("tryoutHistoryMigrations")
            .unique();
          assert.ok(migration);
          await ctx.db.delete(migration._id);
        })
      );
      const before = yield* Effect.promise(() => readCleanupState(t));
      const failure = yield* runCleanup(t).pipe(Effect.flip);
      const after = yield* Effect.promise(() => readCleanupState(t));

      assert.ok(failure.message.includes("lost its root"));
      assert.deepStrictEqual(after, before);
    })
  );

  it.effect(
    "cleans bounded source pages and preserves the permanent target",
    () =>
      Effect.gen(function* () {
        const t = createConvexTestWithBetterAuth();
        const seeded = yield* Effect.promise(() => seedCleanupSuccess(t));
        const pages: { readonly deleted: number; readonly done: boolean }[] =
          [];
        for (let page = 0; page < 32; page += 1) {
          const result = yield* runCleanup(t);
          pages.push(result);
          if (result.done) {
            break;
          }
        }
        const retry = yield* runCleanup(t);
        const state = yield* Effect.promise(() =>
          readCleanupResult(t, {
            sourceScaleId: seeded.sourceScale.scaleVersionId,
            targetAttemptId: seeded.target.attemptId,
            targetBundleId: seeded.target.bundleId,
            targetPlacementId: seeded.target.placement._id,
            targetRunId: seeded.targetRunId,
            targetScaleId: seeded.targetScaleId,
            targetSnapshotId: seeded.target.snapshotId,
          })
        );

        assert.ok(pages.some(({ deleted }) => deleted === 32));
        assert.ok(
          pages.some(({ deleted, done }) => deleted === 4 && done === false)
        );
        assert.strictEqual(pages.at(-1)?.done, true);
        assert.deepStrictEqual(retry, { deleted: 0, done: true });
        assert.ok(state.attempt);
        assert.ok(state.targetBundle);
        assert.ok(state.targetCatalog.length > 0);
        assert.ok(state.targetPlacement);
        assert.ok(state.targetRun);
        assert.ok(state.targetScale);
        assert.ok(state.sharedArtifact);
        assert.strictEqual(state.orphanArtifact, null);
        assert.strictEqual(state.sourceScale, null);
        assert.strictEqual(state.sourceSnapshot, null);
        assert.strictEqual(state.migration, null);
        assert.deepStrictEqual(state.sourceHistory, []);
        assert.deepStrictEqual(state.sourceCatalog, []);
        assert.deepStrictEqual(state.sourceItems, []);
        assert.deepStrictEqual(state.sourcePlacements, []);
        assert.deepStrictEqual(state.sourceRuns, []);
        assert.deepStrictEqual(state.sourceRuntime, []);
        assert.deepStrictEqual(state.legacy, []);
        assert.deepStrictEqual(state.audits, []);
        assert.deepStrictEqual(state.maps, []);
        assert.deepStrictEqual(state.scaleMaps, []);
        assert.deepStrictEqual(state.observers, []);
        assert.strictEqual(state.receipt?.receiptHash, CLEANUP_RECEIPT_HASH);
        assert.strictEqual(state.receipt?.phase, "cleaned");
        assert.strictEqual(state.receipt?.cleanupLimit, CLEANUP_LIMIT);
        assert.strictEqual(state.receipt?.deletedRows, 86);
        assert.deepStrictEqual(state.receipt?.proof, CLEANUP_PROOF);
      })
  );

  it.effect("finishes each scale category across every source scale", () =>
    Effect.gen(function* () {
      const t = createConvexTestWithBetterAuth();
      const seeded = yield* Effect.promise(() => seedCleanupSuccess(t, 2));
      let done = false;
      for (let page = 0; page < 40; page += 1) {
        const result = yield* runCleanup(t);
        if (result.done) {
          done = true;
          break;
        }
      }
      const state = yield* Effect.promise(() =>
        t.run(async (ctx) => ({
          receipt: await ctx.db
            .query("tryoutHistoryMigrationReceipts")
            .unique(),
          sourceScales: await Promise.all(
            seeded.sourceScales.map(({ scaleVersionId }) =>
              ctx.db.get(scaleVersionId)
            )
          ),
          targetScales: await Promise.all(
            seeded.targetScales.map(({ scaleVersionId }) =>
              ctx.db.get(scaleVersionId)
            )
          ),
        }))
      );

      assert.strictEqual(done, true);
      assert.deepStrictEqual(state.sourceScales, [null, null]);
      assert.ok(state.targetScales.every((scale) => scale !== null));
      assert.strictEqual(state.receipt?.phase, "cleaned");
      assert.strictEqual(state.receipt?.deletedRows, 90);
    })
  );

  it.effect("rejects proof changes after the first committed page", () =>
    Effect.gen(function* () {
      const t = createConvexTestWithBetterAuth();
      yield* Effect.promise(() => seedCleanupSuccess(t));
      yield* runCleanup(t);
      const before = yield* Effect.promise(() => readCleanupState(t));
      const failure = yield* runCleanup(t, CLEANUP_RECEIPT_HASH, {
        ...CLEANUP_PROOF,
        sourceSha: "c".repeat(40),
      }).pipe(Effect.flip);
      const after = yield* Effect.promise(() => readCleanupState(t));

      assert.ok(failure.message.includes("proof changed"));
      assert.deepStrictEqual(after, before);
    })
  );

  it.effect("rolls back a page that exceeds signed artifact cardinality", () =>
    Effect.gen(function* () {
      const t = createConvexTestWithBetterAuth();
      yield* Effect.promise(() => seedCleanupSuccess(t));
      for (let page = 0; page < 20; page += 1) {
        const kind = yield* Effect.promise(() =>
          t.query(async (ctx) => {
            const migration = await ctx.db
              .query("tryoutHistoryMigrations")
              .unique();
            return migration?.phase === "cleaning"
              ? migration.cleanup.kind
              : null;
          })
        );
        if (kind === "audit") {
          break;
        }
        yield* runCleanup(t);
      }
      const corruptArtifact = "artifact-cleanup-corrupt";
      yield* Effect.promise(() =>
        t.mutation(async (ctx) => {
          await ctx.db.insert("contentArtifacts", {
            artifactHash: corruptArtifact,
            artifactJson: "{}",
            createdAt: 1,
            retainUntil: Number.MAX_SAFE_INTEGER,
          });
          await ctx.db.insert("tryoutHistoryMigrationMaps", {
            identity: corruptArtifact,
            index: 2,
            kind: "artifact",
            migrationId: CLEANUP_MIGRATION_ID,
            newHash: "artifact-cleanup-corrupt-target",
            oldHash: corruptArtifact,
            targetCreated: false,
          });
        })
      );
      const before = yield* Effect.promise(() => readCleanupState(t));
      const failure = yield* runCleanup(t).pipe(Effect.flip);
      const after = yield* Effect.promise(() => readCleanupState(t));

      assert.ok(failure.message.includes("artifact cardinality"));
      assert.deepStrictEqual(after, before);
    })
  );
});
