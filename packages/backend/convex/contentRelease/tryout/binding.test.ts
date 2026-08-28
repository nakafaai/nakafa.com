import { describe, expect, it } from "@effect/vitest";
import { SignedContentReleaseSchema } from "@nakafa/aksara-contracts/release";
import { LEGACY_TRYOUT_RUNTIME } from "@nakafa/aksara-contracts/release/current/legacy";
import {
  inheritContentSnapshot,
  inheritContentSnapshots,
} from "@nakafa/aksara-contracts/release/snapshot/spec";
import { findReleaseTryoutRuntime } from "@repo/backend/convex/contentRelease/tryout/binding";
import { runConvexProgram } from "@repo/backend/convex/lib/effect";
import schema from "@repo/backend/convex/schema";
import { convexModules } from "@repo/backend/convex/test.setup";
import {
  TEST_DIGEST,
  TEST_MANIFEST_HASH,
  testReleaseJson,
} from "@repo/backend/test/content/release";
import { convexTest, type TestConvex } from "convex-test";
import { Effect, Schema } from "effect";

const snapshots = {
  ...inheritContentSnapshots(null),
  tryout: inheritContentSnapshot(LEGACY_TRYOUT_RUNTIME.snapshotId),
};

/** Builds one coherent release around the retained production snapshot. */
function release(input: {
  readonly manifestHash: string;
  readonly releaseId: string;
}) {
  return Schema.decodeUnknownSync(SignedContentReleaseSchema)(
    JSON.parse(
      testReleaseJson({
        baseManifestHash: TEST_DIGEST,
        baseReleaseId: "release-runtime-parent",
        manifestHash: input.manifestHash,
        releaseId: input.releaseId,
        rendererHash: LEGACY_TRYOUT_RUNTIME.rendererManifestHash,
        snapshots,
      })
    )
  );
}

const legacyRelease = release({
  manifestHash: LEGACY_TRYOUT_RUNTIME.manifestHash,
  releaseId: LEGACY_TRYOUT_RUNTIME.releaseId,
});
const unrelatedRelease = release({
  manifestHash: TEST_MANIFEST_HASH,
  releaseId: "release-runtime-unbound",
});

/** Reads one release binding through the production Effect boundary. */
function findRuntime(
  t: TestConvex<typeof schema>,
  signed: typeof legacyRelease,
  bundleHash?: string
) {
  return t.query((ctx) =>
    runConvexProgram(findReleaseTryoutRuntime(ctx, signed, bundleHash))
  );
}

describe("contentRelease/tryout binding", () => {
  it.effect("keeps only the exact predecessor on its legacy source", () =>
    Effect.gen(function* () {
      const t = convexTest(schema, convexModules);
      yield* Effect.promise(() =>
        t.mutation((ctx) =>
          ctx.db.insert("tryoutRuntimeBundles", {
            bundleHash: TEST_DIGEST,
            bundleJson: "{}",
            cleanupReleaseId: "release-stray",
            createdAt: 1,
            rendererJson: "{}",
            rendererManifestHash: LEGACY_TRYOUT_RUNTIME.rendererManifestHash,
            snapshotId: LEGACY_TRYOUT_RUNTIME.snapshotId,
            sourceGitSha: "a".repeat(40),
            sourceManifestHash: TEST_DIGEST,
            sourceReleaseId: "release-stray",
          })
        )
      );

      const runtime = yield* Effect.promise(() =>
        findRuntime(t, legacyRelease)
      );
      expect(runtime.result).toBeNull();
      yield* Effect.promise(() =>
        expect(findRuntime(t, unrelatedRelease)).rejects.toMatchObject({
          data: { code: "CONTENT_RELEASE_INTEGRITY" },
        })
      );
    })
  );

  it.effect("fails closed when a bound pair is missing or corrupt", () =>
    Effect.gen(function* () {
      const missing = convexTest(schema, convexModules);
      yield* Effect.promise(() =>
        expect(
          findRuntime(missing, legacyRelease, TEST_DIGEST)
        ).rejects.toMatchObject({
          data: { code: "CONTENT_RELEASE_INTEGRITY" },
        })
      );

      const corrupt = convexTest(schema, convexModules);
      yield* Effect.promise(() =>
        corrupt.mutation((ctx) =>
          ctx.db.insert("tryoutRuntimeBundles", {
            bundleHash: TEST_DIGEST,
            bundleJson: "{}",
            cleanupReleaseId: LEGACY_TRYOUT_RUNTIME.releaseId,
            createdAt: 1,
            rendererJson: "{}",
            rendererManifestHash: LEGACY_TRYOUT_RUNTIME.rendererManifestHash,
            snapshotId: LEGACY_TRYOUT_RUNTIME.snapshotId,
            sourceGitSha: "a".repeat(40),
            sourceManifestHash: TEST_DIGEST,
            sourceReleaseId: LEGACY_TRYOUT_RUNTIME.releaseId,
          })
        )
      );
      yield* Effect.promise(() =>
        expect(
          findRuntime(corrupt, legacyRelease, TEST_DIGEST)
        ).rejects.toMatchObject({
          data: { code: "CONTENT_RELEASE_INTEGRITY" },
        })
      );
    })
  );
});
