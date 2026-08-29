import { describe, expect, it } from "@effect/vitest";
import { Sha256HashSchema } from "@nakafa/aksara-contracts/ids";
import { hashText } from "@repo/backend/convex/contentRelease/digest";
import { backfillRuntimeAttempts } from "@repo/backend/convex/contentRelease/finalize/backfill";
import { hashFinalizationPlacements } from "@repo/backend/convex/contentRelease/finalize/proof";
import {
  FINALIZATION_ATTEMPT_SET_DOMAIN,
  type FinalizationContract,
} from "@repo/backend/convex/contentRelease/finalize/spec";
import { runConvexProgram } from "@repo/backend/convex/lib/effect";
import type schema from "@repo/backend/convex/schema";
import { createConvexTestWithBetterAuth } from "@repo/backend/convex/test.helpers";
import { makeRuntimeIngressFixture } from "@repo/backend/test/runtime/ingress";
import {
  insertTryoutAttempt,
  seedTryoutContentAccessState,
} from "@repo/backend/test/tryout/runtime";
import { makeTryoutSet } from "@repo/backend/test/tryouts";
import type { TestConvex } from "convex-test";
import { Effect, Schema } from "effect";

class TestMutationError extends Schema.TaggedError<TestMutationError>()(
  "TestMutationError",
  { cause: Schema.Unknown }
) {}

type FinalizationTest = TestConvex<typeof schema>;

const seedFinalizationState = Effect.fn("test.finalize.seedState")(function* (
  target: FinalizationTest
) {
  const genesis = yield* makeRuntimeIngressFixture();
  const seeded = yield* Effect.promise(() =>
    target.mutation(async (ctx) => {
      const state = await seedTryoutContentAccessState(ctx, {
        attemptStatus: "completed",
        sectionStatus: "completed",
        suffix: "finalization-backfill",
      });
      const [attempt, placement] = await Promise.all([
        ctx.db.get(state.attemptId),
        ctx.db.get(state.placementId),
      ]);
      if (!(attempt?.tryoutBundleHash && attempt.tryoutBundleId && placement)) {
        return null;
      }
      const targetBundle = await ctx.db.get(attempt.tryoutBundleId);
      if (!targetBundle) {
        return null;
      }
      await ctx.db.patch("tryoutAttempts", attempt._id, {
        tryoutBundleHash: undefined,
        tryoutBundleId: undefined,
      });
      return {
        attempt,
        placement,
        targetBundle,
        userId: state.identity.userId,
      };
    })
  );
  if (!seeded) {
    return yield* Effect.die(
      "Expected one complete finalization test fixture."
    );
  }
  const placementDigest = yield* hashFinalizationPlacements([seeded.placement]);
  const attemptSetHash = yield* hashText(
    "terminal try-out attempt set",
    `${FINALIZATION_ATTEMPT_SET_DOMAIN}\n${JSON.stringify([seeded.attempt._id])}`
  );
  const contract = {
    attemptLimit: 10,
    attemptSetHash,
    attempts: [
      {
        appLocale: seeded.attempt.appLocale,
        placementDigest,
        snapshotId: Sha256HashSchema.make(seeded.attempt.tryoutSnapshotId),
        snapshotReleaseId: seeded.attempt.snapshotReleaseId,
        targetBundleHash: Sha256HashSchema.make(seeded.targetBundle.bundleHash),
        totalQuestions: seeded.attempt.totalQuestions,
      },
    ],
    genesisBundleHash: genesis.bundle.bundleHash,
    genesisIdentity: {
      rendererManifestHash: genesis.bundle.payload.rendererManifestHash,
      snapshotId: genesis.bundle.payload.snapshot.snapshotId,
      sourceGitSha: genesis.bundle.payload.sourceGitSha,
      sourceManifestHash: genesis.bundle.payload.sourceManifestHash,
      sourceReleaseId: genesis.bundle.payload.sourceReleaseId,
    },
  } satisfies FinalizationContract;
  return { contract, genesis, ...seeded };
});

const runBackfill = Effect.fn("test.finalize.runBackfill")(function* (
  target: FinalizationTest,
  seeded: Effect.Success<ReturnType<typeof seedFinalizationState>>
) {
  return yield* Effect.tryPromise({
    try: () =>
      target.mutation((ctx) =>
        runConvexProgram(
          backfillRuntimeAttempts(
            ctx,
            seeded.genesis.bundle,
            seeded.genesis.rendererManifest,
            seeded.contract
          )
        )
      ),
    catch: (cause) => new TestMutationError({ cause }),
  });
});

describe("contentRelease/finalize/backfill", () => {
  it.effect(
    "atomically binds the selected attempt and accepts exact retry",
    () =>
      Effect.gen(function* () {
        const target = createConvexTestWithBetterAuth();
        const seeded = yield* seedFinalizationState(target);

        expect(yield* runBackfill(target, seeded)).toEqual({
          backfilledAttempts: 1,
          bundleCreated: 1,
          permanentAttempts: 1,
          placementCount: 1,
        });
        expect(yield* runBackfill(target, seeded)).toEqual({
          backfilledAttempts: 0,
          bundleCreated: 0,
          permanentAttempts: 1,
          placementCount: 1,
        });
        const state = yield* Effect.promise(() =>
          target.run(async (ctx) => ({
            attempt: await ctx.db.get(seeded.attempt._id),
            genesis: await ctx.db
              .query("tryoutRuntimeBundles")
              .withIndex("by_bundleHash", (query) =>
                query.eq("bundleHash", seeded.genesis.bundle.bundleHash)
              )
              .unique(),
          }))
        );
        expect(state.attempt).toMatchObject({
          tryoutBundleHash: seeded.targetBundle.bundleHash,
          tryoutBundleId: seeded.targetBundle._id,
        });
        expect(state.genesis?.bundleHash).toBe(
          seeded.genesis.bundle.bundleHash
        );
      })
  );

  it.effect("rejects an unexpected predecessor attempt", () =>
    Effect.gen(function* () {
      const target = createConvexTestWithBetterAuth();
      const seeded = yield* seedFinalizationState(target);
      yield* Effect.promise(() =>
        target.mutation(async (ctx) => {
          const attemptId = await insertTryoutAttempt(ctx, {
            sectionSnapshots: [],
            set: makeTryoutSet({ setKey: "set-2" }),
            status: "completed",
            userId: seeded.userId,
          });
          await ctx.db.patch("tryoutAttempts", attemptId, {
            completedAt: 1,
            endReason: "submitted",
          });
        })
      );

      const failure = yield* runBackfill(target, seeded).pipe(Effect.flip);
      expect(failure.cause).toMatchObject({
        data: { code: "CONTENT_RELEASE_INTEGRITY" },
      });
    })
  );

  it.effect("rejects a selected non-terminal attempt", () =>
    Effect.gen(function* () {
      const target = createConvexTestWithBetterAuth();
      const seeded = yield* seedFinalizationState(target);
      yield* Effect.promise(() =>
        target.mutation((ctx) =>
          ctx.db.patch("tryoutAttempts", seeded.attempt._id, {
            completedAt: null,
            endReason: null,
            status: "in-progress",
          })
        )
      );

      const failure = yield* runBackfill(target, seeded).pipe(Effect.flip);
      expect(failure.cause).toMatchObject({
        data: { code: "CONTENT_RELEASE_STATE" },
      });
      const genesis = yield* Effect.promise(() =>
        target.run((ctx) =>
          ctx.db
            .query("tryoutRuntimeBundles")
            .withIndex("by_bundleHash", (query) =>
              query.eq("bundleHash", seeded.genesis.bundle.bundleHash)
            )
            .unique()
        )
      );
      expect(genesis).toBeNull();
    })
  );
});
