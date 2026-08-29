import { describe, expect, it } from "@effect/vitest";
import {
  deleteLegacyBundles,
  loadLegacyBundles,
  requirePermanentAttemptOwnership,
  verifyLegacyBundleSet,
} from "@repo/backend/convex/contentRelease/retire/runtime";
import { runConvexProgram } from "@repo/backend/convex/lib/effect";
import schema from "@repo/backend/convex/schema";
import { convexModules } from "@repo/backend/convex/test.setup";
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

describe("contentRelease/retire/runtime", () => {
  it.effect("proves permanent ownership and deletes one exact legacy set", () =>
    Effect.gen(function* () {
      const target = convexTest(schema, convexModules);
      const { contract } = yield* seedRetirementRuntime(target);

      const result = yield* Effect.promise(() =>
        target.mutation((ctx) =>
          runConvexProgram(
            Effect.gen(function* () {
              const permanentAttempts = yield* requirePermanentAttemptOwnership(
                ctx,
                contract
              );
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
            runConvexProgram(requirePermanentAttemptOwnership(ctx, contract))
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
