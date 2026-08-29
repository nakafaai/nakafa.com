import { SignedContentReleaseSchema } from "@nakafa/aksara-contracts/release";
import { ContentSnapshotManifestSchema } from "@nakafa/aksara-contracts/release/snapshot/data";
import { RendererManifestEnvelopeSchema } from "@nakafa/aksara-contracts/renderer/contract";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import { runConvexProgram } from "@repo/backend/convex/lib/effect";
import type schema from "@repo/backend/convex/schema";
import { storeAuthenticatedTryoutRuntimeBundle } from "@repo/backend/convex/tryouts/runtime/signed";
import { testSignedTryoutRuntimeBundle } from "@repo/backend/test/content/proof";
import {
  TEST_RELEASE_ID,
  testTextHash,
} from "@repo/backend/test/content/release";
import type { RuntimeIngressFixture } from "@repo/backend/test/runtime/ingress";
import type { TestConvex } from "convex-test";
import { Effect, Schema } from "effect";

const TEST_RENDERER_HASH = testTextHash("test-attempt-runtime-renderer");

/** Stores one authenticated fixture through the production runtime capability. */
export const storeRuntimeFixture = Effect.fn("test.runtime.storeFixture")(
  function* (t: TestConvex<typeof schema>, fixture: RuntimeIngressFixture) {
    return yield* Effect.promise(() =>
      t.mutation((ctx) =>
        runConvexProgram(
          storeAuthenticatedTryoutRuntimeBundle(
            ctx,
            fixture.bundle,
            fixture.rendererManifest,
            1
          )
        )
      )
    );
  }
);

/** Reuses or creates the permanent identity required by an attempt fixture. */
export async function ensureTestTryoutRuntimeBundle(
  ctx: MutationCtx,
  snapshotId: string,
  sourceReleaseId: string = TEST_RELEASE_ID
) {
  const existing = await ctx.db
    .query("tryoutRuntimeBundles")
    .withIndex("by_snapshotId_and_rendererManifestHash", (index) =>
      index.eq("snapshotId", snapshotId)
    )
    .first();
  if (existing) {
    return { bundleHash: existing.bundleHash, bundleId: existing._id };
  }

  const bundleHash = testTextHash(
    `test-attempt-runtime:${sourceReleaseId}:${snapshotId}`
  );
  const bundleId = await ctx.db.insert("tryoutRuntimeBundles", {
    bundleHash,
    bundleJson: "{}",
    cleanupReleaseId: sourceReleaseId,
    createdAt: 1,
    rendererJson: "{}",
    rendererManifestHash: TEST_RENDERER_HASH,
    snapshotId,
    sourceGitSha: "0".repeat(40),
    sourceManifestHash: testTextHash(`test-runtime-source:${sourceReleaseId}`),
    sourceReleaseId,
  });
  return { bundleHash, bundleId };
}

/** Retains a valid permanent bundle for the active technical try-out snapshot. */
export async function insertTestTryoutRuntimeBundle(
  ctx: MutationCtx,
  snapshotId: string
) {
  const [release, snapshot] = await Promise.all([
    ctx.db.query("contentReleases").unique(),
    ctx.db
      .query("contentSnapshots")
      .withIndex("by_family_and_snapshotId", (index) =>
        index.eq("family", "tryout").eq("snapshotId", snapshotId)
      )
      .unique(),
  ]);
  if (!(release && snapshot)) {
    throw new Error("Expected active release and try-out snapshot fixtures.");
  }
  const signedRelease = Schema.decodeUnknownSync(SignedContentReleaseSchema)(
    JSON.parse(release.releaseJson)
  );
  const renderer = Schema.decodeUnknownSync(RendererManifestEnvelopeSchema)(
    JSON.parse(release.rendererJson)
  );
  const decodedSnapshot = Schema.decodeUnknownSync(
    ContentSnapshotManifestSchema
  )(JSON.parse(snapshot.snapshotJson));
  if (decodedSnapshot.family !== "tryout") {
    throw new Error("Expected a try-out snapshot fixture.");
  }
  const bundle = testSignedTryoutRuntimeBundle({
    release: signedRelease,
    rendererManifest: renderer,
    snapshot: decodedSnapshot.manifest,
  });
  const bundleId = await ctx.db.insert("tryoutRuntimeBundles", {
    bundleHash: bundle.bundleHash,
    bundleJson: JSON.stringify(bundle),
    cleanupReleaseId: bundle.payload.sourceReleaseId,
    createdAt: 1,
    rendererJson: release.rendererJson,
    rendererManifestHash: bundle.payload.rendererManifestHash,
    snapshotId,
    sourceGitSha: bundle.payload.sourceGitSha,
    sourceManifestHash: bundle.payload.sourceManifestHash,
    sourceReleaseId: bundle.payload.sourceReleaseId,
  });
  await ctx.db.patch("contentReleases", release._id, {
    tryoutRuntimeBundleHash: bundle.bundleHash,
  });
  return { bundle, bundleId };
}
