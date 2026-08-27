import { describe, expect, it } from "@effect/vitest";
import { ReleaseIdSchema } from "@nakafa/aksara-contracts/ids";
import schema from "@repo/backend/convex/schema";
import { convexModules } from "@repo/backend/convex/test.setup";
import { storeRuntimeFixture } from "@repo/backend/test/runtime/bundle";
import { makeRuntimeIngressFixture } from "@repo/backend/test/runtime/ingress";
import { convexTest } from "convex-test";
import { Cause, Effect, Exit } from "effect";

/** Returns the complete failure cause from one rejected Convex test program. */
const failureCause = Effect.fn("test.runtime.failureCause")(function* (
  program: Effect.Effect<unknown>
) {
  const exit = yield* Effect.exit(program);
  if (Exit.isSuccess(exit)) {
    return yield* Effect.die("Expected runtime storage to fail.");
  }
  return Cause.pretty(exit.cause);
});

describe("tryouts/runtime signed storage", () => {
  it.effect("reuses one immutable pair across signed source releases", () =>
    Effect.gen(function* () {
      const t = convexTest(schema, convexModules);
      const first = yield* makeRuntimeIngressFixture();
      const second = yield* makeRuntimeIngressFixture(
        ReleaseIdSchema.make("release-runtime-bundle-next")
      );

      const created = yield* storeRuntimeFixture(t, first);
      const reused = yield* storeRuntimeFixture(t, second);
      const stored = yield* Effect.promise(() =>
        t.run((ctx) => ctx.db.query("tryoutRuntimeBundles").collect())
      );

      expect(created).toMatchObject({ created: 1, unchanged: 0 });
      expect(reused).toMatchObject({
        bundleHash: first.bundle.bundleHash,
        created: 0,
        releaseId: second.release.manifest.releaseId,
        unchanged: 1,
      });
      expect(stored).toEqual([
        expect.objectContaining({
          bundleHash: first.bundle.bundleHash,
          sourceReleaseId: first.release.manifest.releaseId,
        }),
      ]);
    })
  );

  it.effect("rejects every corrupted duplicate fact on hash replay", () =>
    Effect.gen(function* () {
      const corruptions = [
        { bundleHash: `sha256:${"2".repeat(64)}` },
        { rendererManifestHash: `sha256:${"3".repeat(64)}` },
        { snapshotId: `sha256:${"4".repeat(64)}` },
        { sourceGitSha: "b".repeat(40) },
        { sourceManifestHash: `sha256:${"5".repeat(64)}` },
        { sourceReleaseId: "release-corrupted" },
      ] as const;

      for (const corruption of corruptions) {
        const t = convexTest(schema, convexModules);
        const fixture = yield* makeRuntimeIngressFixture();
        yield* storeRuntimeFixture(t, fixture);
        yield* Effect.promise(() =>
          t.mutation(async (ctx) => {
            const stored = await ctx.db.query("tryoutRuntimeBundles").unique();
            expect(stored).not.toBeNull();
            if (stored) {
              await ctx.db.patch(
                "tryoutRuntimeBundles",
                stored._id,
                corruption
              );
            }
          })
        );

        const message = yield* failureCause(storeRuntimeFixture(t, fixture));
        expect(message).toContain("CONTENT_RELEASE_INTEGRITY");
      }
    })
  );

  it.effect("rejects changed hash bytes and pair bytes", () =>
    Effect.gen(function* () {
      const hashStore = convexTest(schema, convexModules);
      const first = yield* makeRuntimeIngressFixture();
      yield* storeRuntimeFixture(hashStore, first);
      yield* Effect.promise(() =>
        hashStore.mutation(async (ctx) => {
          const stored = await ctx.db.query("tryoutRuntimeBundles").unique();
          expect(stored).not.toBeNull();
          if (stored) {
            await ctx.db.patch("tryoutRuntimeBundles", stored._id, {
              bundleJson: "{}",
            });
          }
        })
      );
      const hashMessage = yield* failureCause(
        storeRuntimeFixture(hashStore, first)
      );
      expect(hashMessage).toContain("CONTENT_RELEASE_CONFLICT");

      const pairStore = convexTest(schema, convexModules);
      const second = yield* makeRuntimeIngressFixture(
        ReleaseIdSchema.make("release-runtime-bundle-next")
      );
      yield* storeRuntimeFixture(pairStore, first);
      yield* Effect.promise(() =>
        pairStore.mutation(async (ctx) => {
          const stored = await ctx.db.query("tryoutRuntimeBundles").unique();
          expect(stored).not.toBeNull();
          if (stored) {
            await ctx.db.patch("tryoutRuntimeBundles", stored._id, {
              rendererJson: JSON.stringify(
                JSON.parse(stored.rendererJson),
                null,
                2
              ),
            });
          }
        })
      );
      const pairMessage = yield* failureCause(
        storeRuntimeFixture(pairStore, second)
      );
      expect(pairMessage).toContain("CONTENT_RELEASE_CONFLICT");
    })
  );
});
