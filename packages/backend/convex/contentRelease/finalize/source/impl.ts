import type { Sha256Hash } from "@nakafa/aksara-contracts/ids";
import type { QueryCtx } from "@repo/backend/convex/_generated/server";
import { releaseFail } from "@repo/backend/convex/contentRelease/error";
import {
  type FinalizationContract,
  type FinalizationSource,
  finalizationContract,
  GENESIS_RENDERER_SOURCE_HASH,
  genesisIdentity,
} from "@repo/backend/convex/contentRelease/finalize/spec";
import { loadFinalizationTargets } from "@repo/backend/convex/contentRelease/finalize/targets";
import {
  findTryoutRuntimeBundleByHash,
  loadTryoutRuntimeBundle,
} from "@repo/backend/convex/tryouts/runtime/signed";
import { Effect } from "effect";

export interface RendererSourceContract {
  readonly bundleHash: Sha256Hash;
  readonly rendererManifestHash: Sha256Hash;
}

const genesisRendererSource = {
  bundleHash: GENESIS_RENDERER_SOURCE_HASH,
  rendererManifestHash: genesisIdentity.rendererManifestHash,
} satisfies RendererSourceContract;

/** Loads the renderer and every exact pre-existing finalization target. */
export const loadFinalizationSource = Effect.fn(
  "contentRelease.finalize.loadSource"
)(function* (
  ctx: QueryCtx,
  rendererContract: RendererSourceContract = genesisRendererSource,
  contract: FinalizationContract = finalizationContract
) {
  const stored = yield* findTryoutRuntimeBundleByHash(
    ctx,
    rendererContract.bundleHash
  );
  if (
    !stored ||
    stored.bundleHash !== rendererContract.bundleHash ||
    stored.rendererManifestHash !== rendererContract.rendererManifestHash
  ) {
    return yield* releaseFail(
      "CONTENT_RELEASE_INTEGRITY",
      "Genesis renderer source lost its exact permanent identity."
    );
  }
  const loaded = yield* loadTryoutRuntimeBundle(
    ctx,
    stored.snapshotId,
    stored.rendererManifestHash
  );
  if (!loaded || loaded.stored._id !== stored._id) {
    return yield* releaseFail(
      "CONTENT_RELEASE_INTEGRITY",
      "Genesis renderer source failed permanent runtime verification."
    );
  }
  return {
    rendererJson: stored.rendererJson,
    rendererManifestHash: stored.rendererManifestHash,
    targets: yield* loadFinalizationTargets(ctx, contract),
  } satisfies FinalizationSource;
});
