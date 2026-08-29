import {
  type Sha256Hash,
  Sha256HashSchema,
} from "@nakafa/aksara-contracts/ids";
import type { Doc } from "@repo/backend/convex/_generated/dataModel";
import type {
  MutationCtx,
  QueryCtx,
} from "@repo/backend/convex/_generated/server";
import { hashText } from "@repo/backend/convex/contentRelease/digest";
import { releaseFail } from "@repo/backend/convex/contentRelease/error";
import {
  type FinalizationGenesisIdentity,
  GENESIS_BUNDLE_HASH,
  genesisIdentity,
} from "@repo/backend/convex/contentRelease/finalize/spec";
import type {
  RetirementBundleProof,
  RetirementInventory,
} from "@repo/backend/convex/contentRelease/retire/spec";
import {
  findTryoutRuntimeBundleByHash,
  loadTryoutRuntimeBundle,
} from "@repo/backend/convex/tryouts/runtime/signed";
import { Effect } from "effect";

type PermanentBundle = Doc<"tryoutRuntimeBundles">;
type TryoutAttempt = Doc<"tryoutAttempts">;
type RetirementReadCtx = MutationCtx | QueryCtx;

interface PermanentRuntimeOwnership {
  readonly attempts: readonly TryoutAttempt[];
  readonly bundles: readonly PermanentBundle[];
}

/** Branded internal form of the inventory exposed through a Convex validator. */
type RuntimeOwnershipProof = Omit<RetirementInventory, "hash"> & {
  readonly hash: Sha256Hash;
};

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

/** Domain separator for one complete permanent attempt ownership snapshot. */
export const RETIREMENT_RUNTIME_PROOF_DOMAIN =
  "nakafa.tryout-terminal-retirement.runtime-proof.v1";

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

/** Validates duplicated storage identity before Node authenticates the bytes. */
const validatePermanentBundle = Effect.fn(
  "contentRelease.retire.validatePermanentBundle"
)(function* (ctx: RetirementReadCtx, stored: PermanentBundle) {
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
  return stored;
});

/** Requires the immutable bundle created by terminal finalization. */
const requireFinalizationBundle = Effect.fn(
  "contentRelease.retire.requireFinalizationBundle"
)(function* (ctx: RetirementReadCtx, expected: RetirementFinalizationBundle) {
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
  return yield* validatePermanentBundle(ctx, stored);
});

/** Loads the complete attempt binding and every distinct permanent target. */
const loadPermanentOwnership = Effect.fn(
  "contentRelease.retire.loadPermanentOwnership"
)(function* (ctx: RetirementReadCtx, contract: RetirementRuntimeContract) {
  const finalization = yield* requireFinalizationBundle(
    ctx,
    contract.finalizationBundle
  );
  const attempts = yield* Effect.promise(() =>
    ctx.db.query("tryoutAttempts").take(contract.attemptLimit + 1)
  );
  if (attempts.length > contract.attemptLimit) {
    return yield* releaseFail(
      "CONTENT_RELEASE_INTEGRITY",
      "Runtime retirement found an unexpected complete attempt inventory."
    );
  }
  const bundles = new Map<string, PermanentBundle>([
    [finalization._id, finalization],
  ]);
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
    if (!bundles.has(target._id)) {
      bundles.set(target._id, yield* validatePermanentBundle(ctx, target));
    }
  }
  return {
    attempts: [...attempts].sort((left, right) =>
      left._id.localeCompare(right._id)
    ),
    bundles: [...bundles.values()].sort((left, right) =>
      left._id.localeCompare(right._id)
    ),
  } satisfies PermanentRuntimeOwnership;
});

/** Hashes exact bindings and raw stored bytes for the Node-to-transaction seam. */
const hashPermanentOwnership = Effect.fn(
  "contentRelease.retire.hashPermanentOwnership"
)(function* (ownership: PermanentRuntimeOwnership) {
  const bundles = yield* Effect.forEach(ownership.bundles, (bundle) =>
    Effect.all({
      _creationTime: Effect.succeed(bundle._creationTime),
      _id: Effect.succeed(bundle._id),
      bundleHash: Effect.succeed(bundle.bundleHash),
      bundleJsonHash: hashText(
        "permanent runtime bundle bytes",
        bundle.bundleJson
      ),
      cleanupReleaseId: Effect.succeed(bundle.cleanupReleaseId ?? null),
      createdAt: Effect.succeed(bundle.createdAt),
      rendererJsonHash: hashText(
        "permanent runtime renderer bytes",
        bundle.rendererJson
      ),
      rendererManifestHash: Effect.succeed(bundle.rendererManifestHash),
      snapshotId: Effect.succeed(bundle.snapshotId),
      sourceGitSha: Effect.succeed(bundle.sourceGitSha),
      sourceManifestHash: Effect.succeed(bundle.sourceManifestHash),
      sourceReleaseId: Effect.succeed(bundle.sourceReleaseId),
    })
  );
  const attempts = ownership.attempts.map((attempt) => ({
    _id: attempt._id,
    snapshotReleaseId: attempt.snapshotReleaseId,
    tryoutBundleHash: attempt.tryoutBundleHash,
    tryoutBundleId: attempt.tryoutBundleId,
    tryoutSnapshotId: attempt.tryoutSnapshotId,
  }));
  const hash = yield* hashText(
    "permanent runtime ownership proof",
    `${RETIREMENT_RUNTIME_PROOF_DOMAIN}\n${JSON.stringify({ attempts, bundles })}`
  );
  return {
    bundles: bundles
      .map(({ bundleHash, bundleJsonHash, rendererJsonHash }) => ({
        bundleHash,
        bundleJsonHash,
        rendererJsonHash,
      }))
      .sort((left, right) => left.bundleHash.localeCompare(right.bundleHash)),
    hash,
    permanentAttempts: attempts.length,
  } satisfies RuntimeOwnershipProof;
});

/** Reads the compact proof that a Node action must authenticate exactly once. */
export const loadRuntimeOwnershipProof = Effect.fn(
  "contentRelease.retire.loadRuntimeOwnershipProof"
)(function* (
  ctx: RetirementReadCtx,
  contract: RetirementRuntimeContract = retirementRuntimeContract
) {
  return yield* hashPermanentOwnership(
    yield* loadPermanentOwnership(ctx, contract)
  );
});

/** Loads one proof-owned byte pair without allowing a mixed state snapshot. */
export const loadRuntimeBundleSource = Effect.fn(
  "contentRelease.retire.loadRuntimeBundleSource"
)(function* (ctx: RetirementReadCtx, expected: RetirementBundleProof) {
  const stored = yield* findTryoutRuntimeBundleByHash(ctx, expected.bundleHash);
  if (!stored) {
    return yield* releaseFail(
      "CONTENT_RELEASE_INTEGRITY",
      "Runtime retirement lost one proof-owned permanent bundle."
    );
  }
  yield* validatePermanentBundle(ctx, stored);
  const [bundleJsonHash, rendererJsonHash] = yield* Effect.all([
    hashText("permanent runtime bundle bytes", stored.bundleJson),
    hashText("permanent runtime renderer bytes", stored.rendererJson),
  ]);
  if (
    bundleJsonHash !== expected.bundleJsonHash ||
    rendererJsonHash !== expected.rendererJsonHash
  ) {
    return yield* releaseFail(
      "CONTENT_RELEASE_INTEGRITY",
      "Runtime retirement found changed proof-owned permanent bytes."
    );
  }
  return {
    bundleJson: stored.bundleJson,
    rendererJson: stored.rendererJson,
  };
});

/** Rechecks the exact Node-authenticated snapshot inside the final transaction. */
export const requirePermanentAttemptOwnership = Effect.fn(
  "contentRelease.retire.requirePermanentAttempts"
)(function* (
  ctx: MutationCtx,
  expectedProofHash: string,
  contract: RetirementRuntimeContract = retirementRuntimeContract
) {
  const proof = yield* loadRuntimeOwnershipProof(ctx, contract);
  if (proof.hash !== expectedProofHash) {
    return yield* releaseFail(
      "CONTENT_RELEASE_INTEGRITY",
      "Runtime retirement lost its Node-authenticated ownership proof."
    );
  }
  return proof.permanentAttempts;
});
