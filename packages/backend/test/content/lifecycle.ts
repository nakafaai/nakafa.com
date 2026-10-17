import type { SignedContentRelease } from "@nakafa/aksara-contracts/release";
import { releaseReachability } from "@repo/backend/confect/contentRelease/reachability";
import { encodeReleaseJson } from "@repo/backend/confect/contentRelease/wire";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import { Data, Effect } from "effect";

class UnexpectedLifecycleTestState extends Data.TaggedError(
  "UnexpectedLifecycleTestState"
)<{
  readonly operation: "mark-proof-failed";
}> {}

/** Inserts one verified release with explicit frozen renderer bytes. */
export const insertRelease = Effect.fn(
  "test.contentRelease.insertLifecycleRelease"
)(function* (
  ctx: MutationCtx,
  release: SignedContentRelease,
  rendererJson: string
) {
  const now = Date.UTC(2026, 6, 22, 12, 0, 0);
  const releaseId = release.manifest.releaseId;
  yield* Effect.promise(() =>
    ctx.db.insert("contentReleases", {
      ...releaseReachability(release),
      baseFamilies: [],
      checkedIndex: -1,
      checkedItems: 0,
      createdAt: now,
      proofAt: now,
      proofJson: "{}",
      releaseId,
      releaseJson: encodeReleaseJson(release),
      rendererJson,
      resultFamilies: [...release.manifest.scope.families],
      role: "candidate",
      sequence: 1,
      stagedArtifacts: 0,
      stagedDeletes: 0,
      stagedItems: 0,
      stagedProjections: 0,
      stagedRoutes: 0,
      stagedSnapshotBatches: 0,
      stagedSnapshotRows: 0,
      stagedUpserts: 0,
      status: "verified",
      updatedAt: now,
      verifiedAt: now,
    })
  );
  yield* Effect.promise(() =>
    ctx.db.insert("contentState", {
      articleSlot: "blue",
      candidateManifestHash: release.manifestHash,
      candidateReleaseId: releaseId,
      candidateSequence: 1,
      key: "primary",
      materialSlot: "blue",
      nextSequence: 2,
      searchSlot: "blue",
      updatedAt: now,
    })
  );
});

/** Marks one stored proof as terminally failed for ingress observation. */
export const markProofFailed = Effect.fn("test.contentRelease.markProofFailed")(
  function* (ctx: MutationCtx) {
    const stored = yield* Effect.promise(() =>
      ctx.db.query("contentReleases").unique()
    );
    if (!stored) {
      return yield* Effect.die(
        new UnexpectedLifecycleTestState({
          operation: "mark-proof-failed",
        })
      );
    }
    yield* Effect.promise(() =>
      ctx.db.patch("contentReleases", stored._id, {
        proofFailure: "failed",
        status: "verifying",
      })
    );
  }
);
