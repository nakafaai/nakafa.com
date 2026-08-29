import { describe, expect, it } from "@effect/vitest";
import { Ed25519SignatureSchema } from "@nakafa/aksara-contracts/ids";
import { ContentVerificationKeyResolver } from "@nakafa/aksara-contracts/signature/spec";
import { SignedTryoutRuntimeBundleSchema } from "@nakafa/aksara-contracts/tryout/runtime/spec";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import {
  deleteLegacyBundles,
  loadLegacyBundles,
  type RetirementRuntimeContract,
  requirePermanentAttemptOwnership,
  verifyLegacyBundleSet,
} from "@repo/backend/convex/contentRelease/retire/runtime";
import { reconcileTryoutRuntimeAfterAttempt } from "@repo/backend/convex/contentRelease/tryout/runtime";
import { runConvexProgram } from "@repo/backend/convex/lib/effect";
import schema from "@repo/backend/convex/schema";
import { convexModules } from "@repo/backend/convex/test.setup";
import { TEST_KEY_RESOLVER } from "@repo/backend/test/content/proof";
import {
  seedRetirementRuntime,
  TEST_LEGACY_BUNDLE_COUNT,
} from "@repo/backend/test/runtime/retirement";
import { convexTest } from "convex-test";
import { Effect, Schema } from "effect";

class TestMutationError extends Schema.TaggedError<TestMutationError>()(
  "TestMutationError",
  { cause: Schema.Unknown }
) {}

const proveOwnership = Effect.fn("test.retire.proveOwnership")(
  (ctx: MutationCtx, contract: RetirementRuntimeContract) =>
    requirePermanentAttemptOwnership(ctx, contract).pipe(
      Effect.provideService(ContentVerificationKeyResolver, TEST_KEY_RESOLVER)
    )
);

describe("contentRelease/retire/runtime", () => {
  it.effect("proves permanent ownership and deletes one exact legacy set", () =>
    Effect.gen(function* () {
      const target = convexTest(schema, convexModules);
      const { contract } = yield* seedRetirementRuntime(target);

      const result = yield* Effect.promise(() =>
        target.mutation((ctx) =>
          runConvexProgram(
            Effect.gen(function* () {
              const permanentAttempts = yield* proveOwnership(ctx, contract);
              const bundles = yield* verifyLegacyBundleSet(
                yield* loadLegacyBundles(ctx, contract),
                contract
              );
              const deleted = yield* deleteLegacyBundles(ctx, bundles);
              return {
                deleted,
                permanentAttempts,
                remaining: yield* Effect.promise(() =>
                  ctx.db.query("tryoutBundles").collect()
                ),
              };
            })
          )
        )
      );

      expect(result).toEqual({
        deleted: TEST_LEGACY_BUNDLE_COUNT,
        permanentAttempts: 1,
        remaining: [],
      });
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

  it.effect("rejects unauthenticated finalization bundle bytes", () =>
    Effect.gen(function* () {
      const target = convexTest(schema, convexModules);
      const { contract } = yield* seedRetirementRuntime(target);
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

  it.effect("rejects changed bytes in the exact legacy identity set", () =>
    Effect.gen(function* () {
      const target = convexTest(schema, convexModules);
      const { contract } = yield* seedRetirementRuntime(target);
      const changed = yield* Effect.promise(() =>
        target.mutation(async (ctx) => {
          const legacy = await ctx.db.query("tryoutBundles").first();
          if (!legacy) {
            return false;
          }
          await ctx.db.patch("tryoutBundles", legacy._id, {
            releaseJson: JSON.stringify({ changed: true }),
          });
          return true;
        })
      );
      expect(changed).toBe(true);

      const failure = yield* Effect.tryPromise({
        try: () =>
          target.mutation((ctx) =>
            runConvexProgram(
              Effect.gen(function* () {
                yield* verifyLegacyBundleSet(
                  yield* loadLegacyBundles(ctx, contract),
                  contract
                );
              })
            )
          ),
        catch: (cause) => new TestMutationError({ cause }),
      }).pipe(Effect.flip);

      expect(failure.cause).toMatchObject({
        data: { code: "CONTENT_RELEASE_INTEGRITY" },
      });
    })
  );
});
