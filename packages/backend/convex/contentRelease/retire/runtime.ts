import {
  type Sha256Hash,
  Sha256HashSchema,
} from "@nakafa/aksara-contracts/ids";
import { verifySignedTryoutRuntimeBundle } from "@nakafa/aksara-contracts/tryout/runtime/verify";
import type { Doc } from "@repo/backend/convex/_generated/dataModel";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import { hashText } from "@repo/backend/convex/contentRelease/digest";
import { releaseFail } from "@repo/backend/convex/contentRelease/error";
import {
  type FinalizationGenesisIdentity,
  GENESIS_BUNDLE_HASH,
  genesisIdentity,
} from "@repo/backend/convex/contentRelease/finalize/spec";
import { contractFailure } from "@repo/backend/convex/contentRelease/proof/failure";
import {
  findTryoutRuntimeBundleByHash,
  loadTryoutRuntimeBundle,
} from "@repo/backend/convex/tryouts/runtime/signed";
import { Effect } from "effect";

type LegacyBundle = Doc<"tryoutBundles">;
type PermanentBundle = Doc<"tryoutRuntimeBundles">;

export type RetirementFinalizationBundle = FinalizationGenesisIdentity & {
  readonly bundleHash: Sha256Hash;
};

/** Exact terminal runtime state required before legacy bundle deletion. */
export interface RetirementRuntimeContract {
  readonly attemptLimit: number;
  readonly finalizationBundle: RetirementFinalizationBundle;
  readonly legacyBundleCount: number;
  readonly legacyBundleHash: Sha256Hash;
}

/** Domain separator for the complete retained legacy bundle set. */
export const RETIREMENT_LEGACY_SET_DOMAIN =
  "nakafa.tryout-terminal-retirement.legacy-bundle-set.v1";

/** Production facts re-read immediately before the destructive transaction. */
export const retirementRuntimeContract: RetirementRuntimeContract = {
  attemptLimit: 1000,
  finalizationBundle: {
    bundleHash: GENESIS_BUNDLE_HASH,
    ...genesisIdentity,
  },
  legacyBundleCount: 9,
  legacyBundleHash: Sha256HashSchema.make(
    "sha256:4f47e5a27cd5b550cbe60f83c2c6d5041cd18e4efc9a39caf706fa43466c97fb"
  ),
};

/** Cryptographically authenticates one stored permanent runtime bundle. */
const authenticatePermanentBundle = Effect.fn(
  "contentRelease.retire.authenticatePermanentBundle"
)(function* (ctx: MutationCtx, stored: PermanentBundle) {
  const loaded = yield* loadTryoutRuntimeBundle(
    ctx,
    stored.snapshotId,
    stored.rendererManifestHash
  );
  if (!loaded || loaded.stored._id !== stored._id) {
    return yield* releaseFail(
      "CONTENT_RELEASE_INTEGRITY",
      "Runtime retirement could not load one permanent bundle by its exact identity."
    );
  }
  yield* verifySignedTryoutRuntimeBundle({
    bundle: loaded.bundle,
    rendererManifest: loaded.renderer,
  }).pipe(Effect.mapError(contractFailure));
});

/** Requires the immutable bundle created by terminal finalization. */
const requireFinalizationBundle = Effect.fn(
  "contentRelease.retire.requireFinalizationBundle"
)(function* (ctx: MutationCtx, expected: RetirementFinalizationBundle) {
  const stored = yield* findTryoutRuntimeBundleByHash(ctx, expected.bundleHash);
  if (
    !stored ||
    stored.bundleHash !== expected.bundleHash ||
    stored.rendererManifestHash !== expected.rendererManifestHash ||
    stored.snapshotId !== expected.snapshotId ||
    stored.sourceGitSha !== expected.sourceGitSha ||
    stored.sourceManifestHash !== expected.sourceManifestHash ||
    stored.sourceReleaseId !== expected.sourceReleaseId
  ) {
    return yield* releaseFail(
      "CONTENT_RELEASE_INTEGRITY",
      "Runtime retirement lost its exact finalization bundle proof."
    );
  }
  yield* authenticatePermanentBundle(ctx, stored);
});

/** Projects every stored field, including the opaque row identity. */
function legacyBundleFacts(bundle: LegacyBundle) {
  return {
    _id: bundle._id,
    createdAt: bundle.createdAt,
    index: bundle.index,
    manifestHash: bundle.manifestHash,
    releaseId: bundle.releaseId,
    releaseJson: bundle.releaseJson,
    rendererJson: bundle.rendererJson,
    snapshotId: bundle.snapshotId,
  };
}

/** Requires every attempt to resolve through one authenticated permanent bundle. */
export const requirePermanentAttemptOwnership = Effect.fn(
  "contentRelease.retire.requirePermanentAttempts"
)(function* (
  ctx: MutationCtx,
  contract: RetirementRuntimeContract = retirementRuntimeContract
) {
  yield* requireFinalizationBundle(ctx, contract.finalizationBundle);
  const attempts = yield* Effect.promise(() =>
    ctx.db.query("tryoutAttempts").take(contract.attemptLimit + 1)
  );
  if (attempts.length > contract.attemptLimit) {
    return yield* releaseFail(
      "CONTENT_RELEASE_INTEGRITY",
      "Runtime retirement found an unexpected complete attempt inventory."
    );
  }
  const authenticated = new Set<string>();
  for (const attempt of attempts) {
    const bundleId = attempt.tryoutBundleId;
    const bundleHash = attempt.tryoutBundleHash;
    if (bundleId === undefined || bundleHash === undefined) {
      return yield* releaseFail(
        "CONTENT_RELEASE_INTEGRITY",
        "Runtime retirement found a predecessor-bound attempt."
      );
    }
    const target = yield* Effect.promise(() => ctx.db.get(bundleId));
    if (
      !target ||
      target.bundleHash !== bundleHash ||
      target.snapshotId !== attempt.tryoutSnapshotId
    ) {
      return yield* releaseFail(
        "CONTENT_RELEASE_INTEGRITY",
        "Runtime retirement found a changed permanent attempt target."
      );
    }
    if (!authenticated.has(target._id)) {
      yield* authenticatePermanentBundle(ctx, target);
      authenticated.add(target._id);
    }
  }
  return attempts.length;
});

/** Reads the complete bounded legacy set without deleting any row. */
export const loadLegacyBundles = Effect.fn(
  "contentRelease.retire.loadLegacyBundles"
)(function* (
  ctx: MutationCtx,
  contract: RetirementRuntimeContract = retirementRuntimeContract
) {
  return yield* Effect.promise(() =>
    ctx.db.query("tryoutBundles").take(contract.legacyBundleCount + 1)
  );
});

/** Requires exact identity-set equality and complete stored byte equality. */
export const hashLegacyBundleSet = Effect.fn(
  "contentRelease.retire.hashLegacyBundles"
)(function* (bundles: readonly LegacyBundle[]) {
  const facts = [...bundles]
    .sort((left, right) => left._id.localeCompare(right._id))
    .map(legacyBundleFacts);
  return yield* hashText(
    "terminal legacy bundle set",
    `${RETIREMENT_LEGACY_SET_DOMAIN}\n${JSON.stringify(facts)}`
  );
});

/** Requires exact identity-set equality and complete stored byte equality. */
export const verifyLegacyBundleSet = Effect.fn(
  "contentRelease.retire.verifyLegacyBundles"
)(function* (
  bundles: readonly LegacyBundle[],
  contract: RetirementRuntimeContract = retirementRuntimeContract
) {
  if (
    bundles.length !== contract.legacyBundleCount ||
    new Set(bundles.map((bundle) => bundle._id)).size !== bundles.length
  ) {
    return yield* releaseFail(
      "CONTENT_RELEASE_INTEGRITY",
      "Runtime retirement found a changed legacy bundle identity set."
    );
  }
  const digest = yield* hashLegacyBundleSet(bundles);
  if (digest !== contract.legacyBundleHash) {
    return yield* releaseFail(
      "CONTENT_RELEASE_INTEGRITY",
      "Runtime retirement found changed legacy bundle bytes."
    );
  }
  return bundles;
});

/** Deletes one already-proven exact legacy set inside the owning transaction. */
export const deleteLegacyBundles = Effect.fn(
  "contentRelease.retire.deleteLegacyBundles"
)(function* (ctx: MutationCtx, bundles: readonly LegacyBundle[]) {
  yield* Effect.forEach(bundles, (bundle) =>
    Effect.promise(() => ctx.db.delete("tryoutBundles", bundle._id))
  );
  return bundles.length;
});
