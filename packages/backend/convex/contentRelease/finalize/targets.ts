import type {
  MutationCtx,
  QueryCtx,
} from "@repo/backend/convex/_generated/server";
import { hashText } from "@repo/backend/convex/contentRelease/digest";
import { releaseFail } from "@repo/backend/convex/contentRelease/error";
import type {
  FinalizationContract,
  FinalizationTargetSource,
} from "@repo/backend/convex/contentRelease/finalize/spec";
import { findTryoutRuntimeBundleByHash } from "@repo/backend/convex/tryouts/runtime/signed";
import { Effect } from "effect";

type FinalizationReadCtx = MutationCtx | QueryCtx;

/** Domain separator for the complete pre-existing target identity set. */
export const FINALIZATION_TARGET_SET_DOMAIN =
  "nakafa.tryout-terminal-backfill.target-set.v1";

/** Derives every pre-existing target from the one finalization contract. */
export function selectFinalizationTargetHashes(
  contract: Pick<FinalizationContract, "attempts" | "genesisBundleHash">
) {
  return [
    ...new Set(
      contract.attempts
        .map(({ targetBundleHash }) => targetBundleHash)
        .filter((bundleHash) => bundleHash !== contract.genesisBundleHash)
    ),
  ].sort();
}

/** Loads every exact stored fact that the Node boundary must authenticate. */
export const loadFinalizationTargets = Effect.fn(
  "contentRelease.finalize.loadTargets"
)(function* (ctx: FinalizationReadCtx, contract: FinalizationContract) {
  const hashes = selectFinalizationTargetHashes(contract);
  return yield* Effect.forEach(hashes, (bundleHash) =>
    Effect.gen(function* () {
      const stored = yield* findTryoutRuntimeBundleByHash(ctx, bundleHash);
      if (!stored) {
        return yield* releaseFail(
          "CONTENT_RELEASE_INTEGRITY",
          "Terminal try-out expansion lost a pre-existing target bundle."
        );
      }
      return {
        _creationTime: stored._creationTime,
        _id: stored._id,
        bundleHash: stored.bundleHash,
        bundleJson: stored.bundleJson,
        cleanupReleaseId: stored.cleanupReleaseId,
        createdAt: stored.createdAt,
        rendererJson: stored.rendererJson,
        rendererManifestHash: stored.rendererManifestHash,
        snapshotId: stored.snapshotId,
        sourceGitSha: stored.sourceGitSha,
        sourceManifestHash: stored.sourceManifestHash,
        sourceReleaseId: stored.sourceReleaseId,
      } satisfies FinalizationTargetSource;
    })
  );
});

/** Hashes exact row identities, metadata, and raw stored bytes. */
export const hashFinalizationTargets = Effect.fn(
  "contentRelease.finalize.hashTargets"
)(function* (sources: readonly FinalizationTargetSource[]) {
  const facts = [...sources]
    .sort((left, right) => left.bundleHash.localeCompare(right.bundleHash))
    .map((source) => ({
      _creationTime: source._creationTime,
      _id: source._id,
      bundleHash: source.bundleHash,
      bundleJson: source.bundleJson,
      cleanupReleaseId: source.cleanupReleaseId ?? null,
      createdAt: source.createdAt,
      rendererJson: source.rendererJson,
      rendererManifestHash: source.rendererManifestHash,
      snapshotId: source.snapshotId,
      sourceGitSha: source.sourceGitSha,
      sourceManifestHash: source.sourceManifestHash,
      sourceReleaseId: source.sourceReleaseId,
    }));
  return yield* hashText(
    "terminal finalization target set",
    `${FINALIZATION_TARGET_SET_DOMAIN}\n${JSON.stringify(facts)}`
  );
});

/** Recomputes the Node-authenticated target proof inside the transaction. */
export const requireFinalizationTargetProof = Effect.fn(
  "contentRelease.finalize.requireTargetProof"
)(function* (
  ctx: MutationCtx,
  expectedHash: string,
  contract: FinalizationContract
) {
  const sources = yield* loadFinalizationTargets(ctx, contract);
  const hash = yield* hashFinalizationTargets(sources);
  if (hash !== expectedHash) {
    return yield* releaseFail(
      "CONTENT_RELEASE_INTEGRITY",
      "Terminal try-out expansion lost its Node-authenticated target proof."
    );
  }
  return sources;
});
