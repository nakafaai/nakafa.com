import { describe, expect, it } from "@effect/vitest";
import { Ed25519SignatureSchema } from "@nakafa/aksara-contracts/ids";
import { SignedTryoutRuntimeBundleSchema } from "@nakafa/aksara-contracts/tryout/runtime/spec";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import {
  loadRuntimeBundleSource,
  loadRuntimeOwnershipProof,
  type RetirementRuntimeContract,
  requirePermanentAttemptOwnership,
} from "@repo/backend/convex/contentRelease/retire/runtime";
import { reconcileTryoutRuntimeAfterAttempt } from "@repo/backend/convex/contentRelease/tryout/runtime";
import { runConvexProgram } from "@repo/backend/convex/lib/effect";
import schema from "@repo/backend/convex/schema";
import { convexModules } from "@repo/backend/convex/test.setup";
import { seedRetirementRuntime } from "@repo/backend/test/runtime/retirement";
import { convexTest } from "convex-test";
import { Effect, Schema } from "effect";

class TestMutationError extends Schema.TaggedError<TestMutationError>()(
  "TestMutationError",
  { cause: Schema.Unknown }
) {}

const proveOwnership = Effect.fn("test.retire.proveOwnership")(function* (
  ctx: MutationCtx,
  contract: RetirementRuntimeContract,
  expectedProofHash?: string
) {
  const proofHash =
    expectedProofHash ?? (yield* loadRuntimeOwnershipProof(ctx, contract)).hash;
  return yield* requirePermanentAttemptOwnership(ctx, proofHash, contract);
});

describe("contentRelease/retire/runtime", () => {
  it.effect("proves one complete permanent ownership snapshot", () =>
    Effect.gen(function* () {
      const target = convexTest(schema, convexModules);
      const { contract } = yield* seedRetirementRuntime(target);

      const permanentAttempts = yield* Effect.promise(() =>
        target.mutation((ctx) =>
          runConvexProgram(proveOwnership(ctx, contract))
        )
      );

      expect(permanentAttempts).toBe(1);
    })
  );

  it.effect("accepts no attempts after account erasure reconciliation", () =>
    Effect.gen(function* () {
      const target = convexTest(schema, convexModules);
      const { attemptId, contract } = yield* seedRetirementRuntime(target);
      yield* Effect.promise(() =>
        target.mutation((ctx) =>
          runConvexProgram(
            Effect.gen(function* () {
              const attempt = yield* Effect.promise(() =>
                ctx.db.get("tryoutAttempts", attemptId)
              );
              if (!attempt?.tryoutBundleId) {
                return yield* Effect.die(
                  "Expected one permanent retirement attempt."
                );
              }
              yield* Effect.promise(() =>
                ctx.db.delete("tryoutAttempts", attemptId)
              );
              yield* reconcileTryoutRuntimeAfterAttempt(
                ctx,
                attempt.tryoutBundleId
              );
            })
          )
        )
      );

      const permanentAttempts = yield* Effect.promise(() =>
        target.mutation((ctx) =>
          runConvexProgram(proveOwnership(ctx, contract))
        )
      );

      expect(permanentAttempts).toBe(0);
    })
  );

  it.effect(
    "accepts a later release that reuses an authenticated runtime",
    () =>
      Effect.gen(function* () {
        const target = convexTest(schema, convexModules);
        const { attemptId, contract } = yield* seedRetirementRuntime(target);
        yield* Effect.promise(() =>
          target.mutation((ctx) =>
            ctx.db.patch("tryoutAttempts", attemptId, {
              snapshotReleaseId: "later-release-reusing-runtime",
            })
          )
        );

        const permanentAttempts = yield* Effect.promise(() =>
          target.mutation((ctx) =>
            runConvexProgram(proveOwnership(ctx, contract))
          )
        );

        expect(permanentAttempts).toBe(1);
      })
  );

  it.effect("rejects an empty deployment without finalization proof", () =>
    Effect.gen(function* () {
      const target = convexTest(schema, convexModules);
      const { attemptId, contract } = yield* seedRetirementRuntime(target);
      yield* Effect.promise(() =>
        target.mutation(async (ctx) => {
          await ctx.db.delete("tryoutAttempts", attemptId);
          const bundle = await ctx.db.query("tryoutRuntimeBundles").unique();
          expect(bundle).not.toBeNull();
          if (bundle) {
            await ctx.db.delete("tryoutRuntimeBundles", bundle._id);
          }
        })
      );

      const failure = yield* Effect.tryPromise({
        try: () =>
          target.mutation((ctx) =>
            runConvexProgram(proveOwnership(ctx, contract))
          ),
        catch: (cause) => new TestMutationError({ cause }),
      }).pipe(Effect.flip);

      expect(failure.cause).toMatchObject({
        data: { code: "CONTENT_RELEASE_INTEGRITY" },
      });
    })
  );

  it.effect("rejects bytes changed after Node authentication", () =>
    Effect.gen(function* () {
      const target = convexTest(schema, convexModules);
      const { contract } = yield* seedRetirementRuntime(target);
      const proof = yield* Effect.promise(() =>
        target.query((ctx) =>
          runConvexProgram(loadRuntimeOwnershipProof(ctx, contract))
        )
      );
      const expected = proof.bundles[0];
      if (!expected) {
        return yield* Effect.die("Expected one permanent runtime proof.");
      }
      yield* Effect.promise(() =>
        target.mutation(async (ctx) => {
          const stored = await ctx.db.query("tryoutRuntimeBundles").unique();
          expect(stored).not.toBeNull();
          if (!stored) {
            return;
          }
          const bundle = Schema.decodeUnknownSync(
            SignedTryoutRuntimeBundleSchema
          )(JSON.parse(stored.bundleJson));
          await ctx.db.patch("tryoutRuntimeBundles", stored._id, {
            bundleJson: JSON.stringify({
              ...bundle,
              signature: Ed25519SignatureSchema.make("A".repeat(86)),
            }),
          });
        })
      );

      const sourceFailure = yield* Effect.tryPromise({
        try: () =>
          target.query((ctx) =>
            runConvexProgram(loadRuntimeBundleSource(ctx, expected))
          ),
        catch: (cause) => new TestMutationError({ cause }),
      }).pipe(Effect.flip);
      const failure = yield* Effect.tryPromise({
        try: () =>
          target.mutation((ctx) =>
            runConvexProgram(proveOwnership(ctx, contract, proof.hash))
          ),
        catch: (cause) => new TestMutationError({ cause }),
      }).pipe(Effect.flip);

      expect(sourceFailure.cause).toMatchObject({
        data: { code: "CONTENT_RELEASE_INTEGRITY" },
      });
      expect(failure.cause).toMatchObject({
        data: { code: "CONTENT_RELEASE_INTEGRITY" },
      });
    })
  );

  it.effect("rejects a changed permanent attempt target", () =>
    Effect.gen(function* () {
      const target = convexTest(schema, convexModules);
      const { attemptId, contract } = yield* seedRetirementRuntime(target);
      yield* Effect.promise(() =>
        target.mutation((ctx) =>
          ctx.db.patch("tryoutAttempts", attemptId, {
            tryoutBundleHash: `sha256:${"f".repeat(64)}`,
          })
        )
      );

      const failure = yield* Effect.tryPromise({
        try: () =>
          target.mutation((ctx) =>
            runConvexProgram(proveOwnership(ctx, contract))
          ),
        catch: (cause) => new TestMutationError({ cause }),
      }).pipe(Effect.flip);

      expect(failure.cause).toMatchObject({
        data: { code: "CONTENT_RELEASE_INTEGRITY" },
      });
    })
  );
});
