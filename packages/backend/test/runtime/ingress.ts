import {
  GitCommitShaSchema,
  ReleaseIdSchema,
} from "@nakafa/aksara-contracts/ids";
import { ContentReleaseManifestSchema } from "@nakafa/aksara-contracts/release";
import {
  inheritContentSnapshots,
  replaceContentSnapshot,
} from "@nakafa/aksara-contracts/release/snapshot/spec";
import { ContentVerificationKeyResolver } from "@nakafa/aksara-contracts/signature/spec";
import { makeTryoutSnapshot } from "@nakafa/aksara-contracts/tryout/snapshot/hash";
import { stagePublication } from "@repo/backend/convex/contentRelease/ingress/stage";
import { runConvexProgram } from "@repo/backend/convex/lib/effect";
import type schema from "@repo/backend/convex/schema";
import {
  TEST_KEY_ID,
  TEST_KEY_RESOLVER,
  TEST_PROOF_RENDERER,
  testEmptyManifest,
  testProofRenderer,
  testSignedRelease,
  testSignedTryoutRuntimeBundle,
} from "@repo/backend/test/content/proof";
import { testPublicationScope } from "@repo/backend/test/content/release";
import { insertSignedCandidate } from "@repo/backend/test/content/stage";
import { makeTryoutSnapshotManifest } from "@repo/backend/test/tryout/snapshot";
import type { TestConvex } from "convex-test";
import { Effect } from "effect";

export const TEST_RUNTIME_RELEASE_ID = ReleaseIdSchema.make(
  "release-runtime-bundle"
);

/** Creates one coherent signed release and its permanent runtime bundle. */
export const makeRuntimeIngressFixture = Effect.fn(
  "test.runtime.makeIngressFixture"
)(function* (
  releaseId = TEST_RUNTIME_RELEASE_ID,
  rendererManifest = TEST_PROOF_RENDERER,
  options?: {
    readonly bundleSnapshot?: "base" | "result";
    readonly hasBaseSnapshot?: boolean;
    readonly sourceGitSha?: string;
    readonly snapshotRouteCountDelta?: number;
  }
) {
  const technicalSnapshot = (yield* makeTryoutSnapshotManifest()).manifest;
  const resultSnapshot = options?.snapshotRouteCountDelta
    ? makeTryoutSnapshot({
        activeAppLocales: technicalSnapshot.activeAppLocales,
        catalogDigest: technicalSnapshot.catalogDigest,
        counts: technicalSnapshot.counts,
        placementCount: technicalSnapshot.placementCount,
        placementDigest: technicalSnapshot.placementDigest,
        routeCount:
          technicalSnapshot.routeCount + options.snapshotRouteCountDelta,
      })
    : technicalSnapshot;
  const baseSnapshot = makeTryoutSnapshot({
    activeAppLocales: technicalSnapshot.activeAppLocales,
    catalogDigest: technicalSnapshot.catalogDigest,
    counts: technicalSnapshot.counts,
    placementCount: technicalSnapshot.placementCount,
    placementDigest: technicalSnapshot.placementDigest,
    routeCount: technicalSnapshot.routeCount + 2,
  });
  const snapshots = {
    ...inheritContentSnapshots(null),
    tryout: replaceContentSnapshot({
      baseSnapshotId: options?.hasBaseSnapshot ? baseSnapshot.snapshotId : null,
      resultSnapshotId: resultSnapshot.snapshotId,
      rowCount: resultSnapshot.placementCount + 3,
      rowDigest: resultSnapshot.snapshotId,
    }),
  };
  const emptyManifest = testEmptyManifest(releaseId);
  const release = testSignedRelease(
    ContentReleaseManifestSchema.make({
      ...emptyManifest,
      baseActiveAppLocales: options?.hasBaseSnapshot
        ? emptyManifest.activeAppLocales
        : null,
      baseManifestHash: options?.hasBaseSnapshot
        ? baseSnapshot.snapshotId
        : null,
      baseReleaseId: options?.hasBaseSnapshot
        ? ReleaseIdSchema.make(`${releaseId}-base`)
        : null,
      origin: {
        kind: "git",
        sha: GitCommitShaSchema.make(options?.sourceGitSha ?? "a".repeat(40)),
      },
      rendererManifestHash: rendererManifest.hash,
      scope: testPublicationScope({ snapshots }),
      snapshots,
    })
  );
  const snapshot =
    options?.bundleSnapshot === "base" ? baseSnapshot : resultSnapshot;
  return {
    bundle: testSignedTryoutRuntimeBundle({
      release,
      rendererManifest,
      snapshot,
    }),
    release,
    rendererManifest,
    snapshot,
  };
});

export type RuntimeIngressFixture = Effect.Success<
  ReturnType<typeof makeRuntimeIngressFixture>
>;

/** Runs one authenticated bundle request through the Node staging seam. */
export const stageRuntimeIngress = Effect.fn("test.runtime.stageIngress")(
  function* (
    t: TestConvex<typeof schema>,
    fixture: RuntimeIngressFixture,
    activeKeyId = TEST_KEY_ID
  ) {
    return yield* Effect.tryPromise(() =>
      t.action((ctx) =>
        runConvexProgram(
          stagePublication(
            ctx,
            {
              bundle: fixture.bundle,
              operation: "stageTryoutRuntimeBundle",
              releaseId: fixture.release.manifest.releaseId,
            },
            activeKeyId
          ).pipe(
            Effect.provideService(
              ContentVerificationKeyResolver,
              TEST_KEY_RESOLVER
            )
          )
        )
      )
    );
  }
);

/** Inserts the exact staged source envelope required by one fixture. */
export const insertRuntimeIngressSource = Effect.fn(
  "test.runtime.insertIngressSource"
)(function* (t: TestConvex<typeof schema>, fixture: RuntimeIngressFixture) {
  yield* Effect.promise(() =>
    t.mutation((ctx) =>
      insertSignedCandidate(
        ctx,
        fixture.release.manifest.releaseId,
        fixture.release,
        JSON.stringify(fixture.rendererManifest)
      )
    )
  );
});

/** Produces another deterministic renderer manifest for drift cases. */
export function makeRuntimeIngressRenderer() {
  return testProofRenderer("h2");
}
