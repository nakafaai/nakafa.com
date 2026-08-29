import {
  hashLegacyBundleSet,
  loadLegacyBundles,
  type RetirementRuntimeContract,
} from "@repo/backend/convex/contentRelease/retire/runtime";
import { runConvexProgram } from "@repo/backend/convex/lib/effect";
import type schema from "@repo/backend/convex/schema";
import { storeRuntimeFixture } from "@repo/backend/test/runtime/bundle";
import {
  makeRuntimeIngressFixture,
  type RuntimeIngressFixture,
} from "@repo/backend/test/runtime/ingress";
import {
  insertTryoutAttempt,
  insertTryoutUser,
} from "@repo/backend/test/tryout/runtime";
import { makeTryoutSet } from "@repo/backend/test/tryouts";
import type { TestConvex } from "convex-test";
import { Effect } from "effect";

export const TEST_LEGACY_BUNDLE_COUNT = 2;

/** Inserts one permanent attempt plus a complete synthetic legacy set. */
export const seedRetirementRuntime = Effect.fn(
  "test.runtime.seedRetirementRuntime"
)(function* (
  target: TestConvex<typeof schema>,
  fixture?: RuntimeIngressFixture
) {
  const runtimeFixture =
    fixture === undefined ? yield* makeRuntimeIngressFixture() : fixture;
  yield* storeRuntimeFixture(target, runtimeFixture);
  const attemptId = yield* Effect.promise(() =>
    target.mutation(async (ctx) => {
      const targetBundle = await ctx.db
        .query("tryoutRuntimeBundles")
        .withIndex("by_bundleHash", (query) =>
          query.eq("bundleHash", runtimeFixture.bundle.bundleHash)
        )
        .unique();
      if (!targetBundle) {
        return null;
      }
      await ctx.db.patch("tryoutRuntimeBundles", targetBundle._id, {
        cleanupReleaseId: undefined,
      });
      const userId = await insertTryoutUser(ctx, {
        authId: "retirement-runtime-user",
        email: "retirement-runtime@example.com",
        name: "Retirement Runtime",
      });
      const storedAttemptId = await insertTryoutAttempt(ctx, {
        sectionSnapshots: [],
        set: makeTryoutSet(),
        snapshotId: runtimeFixture.bundle.payload.snapshot.snapshotId,
        snapshotReleaseId: runtimeFixture.bundle.payload.sourceReleaseId,
        userId,
      });
      await ctx.db.patch("tryoutAttempts", storedAttemptId, {
        tryoutBundleHash: targetBundle.bundleHash,
        tryoutBundleId: targetBundle._id,
      });
      for (let index = 0; index < TEST_LEGACY_BUNDLE_COUNT; index += 1) {
        await ctx.db.insert("tryoutBundles", {
          createdAt: index + 1,
          index,
          manifestHash: `sha256:${String(index + 1).padStart(64, "0")}`,
          releaseId: `legacy-release-${index}`,
          releaseJson: JSON.stringify({ index, kind: "release" }),
          rendererJson: JSON.stringify({ index, kind: "renderer" }),
          snapshotId: runtimeFixture.bundle.payload.snapshot.snapshotId,
        });
      }
      return storedAttemptId;
    })
  );
  if (!attemptId) {
    return yield* Effect.die(
      "Expected one permanent runtime bundle in the retirement fixture."
    );
  }
  const legacyBundleHash = yield* Effect.promise(() =>
    target.mutation((ctx) =>
      runConvexProgram(
        Effect.gen(function* () {
          return yield* hashLegacyBundleSet(yield* loadLegacyBundles(ctx));
        })
      )
    )
  );
  const contract = {
    attemptLimit: 10,
    finalizationBundle: {
      bundleHash: runtimeFixture.bundle.bundleHash,
      rendererManifestHash: runtimeFixture.bundle.payload.rendererManifestHash,
      snapshotId: runtimeFixture.bundle.payload.snapshot.snapshotId,
      sourceGitSha: runtimeFixture.bundle.payload.sourceGitSha,
      sourceManifestHash: runtimeFixture.bundle.payload.sourceManifestHash,
      sourceReleaseId: runtimeFixture.bundle.payload.sourceReleaseId,
    },
    legacyBundleCount: TEST_LEGACY_BUNDLE_COUNT,
    legacyBundleHash,
  } satisfies RetirementRuntimeContract;
  return { attemptId, contract, fixture: runtimeFixture };
});
