import type { Doc } from "@repo/backend/convex/_generated/dataModel";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import { hashText } from "@repo/backend/convex/contentRelease/digest";
import { releaseFail } from "@repo/backend/convex/contentRelease/error";
import {
  type RetirementRuntimeContract,
  retirementRuntimeContract,
} from "@repo/backend/convex/contentRelease/retire/runtime";
import { Effect } from "effect";

type LegacyBundle = Doc<"tryoutBundles">;

/** Domain separator for the complete retained legacy bundle set. */
export const RETIREMENT_LEGACY_SET_DOMAIN =
  "nakafa.tryout-terminal-retirement.legacy-bundle-set.v1";

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

/** Hashes one exact identity set and all of its stored bytes. */
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
