import { ReleaseIdSchema } from "@nakafa/aksara-contracts/ids";
import {
  ContentReleaseManifestSchema,
  RollbackSignedContentReleaseSchema,
  type SignedContentRelease,
} from "@nakafa/aksara-contracts/release";
import { PublicationScopeSchema } from "@nakafa/aksara-contracts/release/snapshot/scope";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import { encodeRendererJson } from "@repo/backend/convex/contentRelease/wire";
import {
  TEST_PROOF_RENDERER,
  testEmptyManifest,
  testSignedRelease,
} from "@repo/backend/test/content/proof";
import {
  insertTestState,
  insertZeroRelease,
} from "@repo/backend/test/content/state";
import { Effect } from "effect";

const releaseId = ReleaseIdSchema.make("release-lifecycle-ingress");
const recoveryReleaseId = ReleaseIdSchema.make(
  "release-lifecycle-ingress-recovery"
);

/** Inserts one authenticated zero-impact candidate and its exact inverse. */
export const insertActivationPair = Effect.fn(
  "test.contentRelease.insertActivationPair"
)(function* (
  ctx: MutationCtx,
  candidate: SignedContentRelease,
  recovery: SignedContentRelease
) {
  const candidateIdentity = {
    manifestHash: candidate.manifestHash,
    releaseId: candidate.manifest.releaseId,
    sequence: 1,
  };
  const recoveryIdentity = {
    manifestHash: recovery.manifestHash,
    releaseId: recovery.manifest.releaseId,
    sequence: 2,
  };
  yield* Effect.promise(() =>
    insertZeroRelease(ctx, {
      ...candidateIdentity,
      ownership: { base: [], result: [] },
      role: "candidate",
      scope: candidate.manifest.scope,
      snapshots: candidate.manifest.snapshots,
      status: "verified",
    })
  );
  yield* Effect.promise(() =>
    insertZeroRelease(ctx, {
      ...recoveryIdentity,
      base: candidateIdentity,
      originReleaseId: candidate.manifest.releaseId,
      ownership: { base: [], result: [] },
      role: "recovery",
      scope: recovery.manifest.scope,
      snapshots: recovery.manifest.snapshots,
      status: "verified",
    })
  );
  const rendererJson = encodeRendererJson(TEST_PROOF_RENDERER);
  const releases = yield* Effect.promise(() =>
    ctx.db.query("contentReleases").collect()
  );
  for (const stored of releases) {
    const signed =
      stored.releaseId === candidate.manifest.releaseId ? candidate : recovery;
    yield* Effect.promise(() =>
      ctx.db.patch("contentReleases", stored._id, {
        releaseJson: JSON.stringify(signed),
        rendererJson,
      })
    );
  }
  yield* Effect.promise(() =>
    insertTestState(ctx, {
      candidate: candidateIdentity,
      nextSequence: 3,
      recovery: recoveryIdentity,
    })
  );
});

/** Creates signed zero-impact manifests that complete read models immediately. */
export function makeActivationPair() {
  const scope = PublicationScopeSchema.make({
    families: ["page"],
    snapshots: [],
  });
  const candidateManifest = ContentReleaseManifestSchema.make({
    ...testEmptyManifest(releaseId),
    scope,
  });
  const candidate = testSignedRelease(candidateManifest);
  const recoveryManifest = ContentReleaseManifestSchema.make({
    ...testEmptyManifest(recoveryReleaseId),
    baseActiveAppLocales: candidateManifest.activeAppLocales,
    baseManifestHash: candidate.manifestHash,
    baseReleaseId: releaseId,
    origin: { kind: "rollback", releaseId },
    scope,
  });
  return {
    candidate,
    recovery: RollbackSignedContentReleaseSchema.make(
      testSignedRelease(recoveryManifest)
    ),
  };
}
