import type { Sha256Hash } from "@nakafa/aksara-contracts/ids";
import type { QueryCtx } from "@repo/backend/convex/_generated/server";
import { internalQuery } from "@repo/backend/convex/_generated/server";
import { releaseFail } from "@repo/backend/convex/contentRelease/error";
import {
  GENESIS_RENDERER_SOURCE_HASH,
  genesisIdentity,
} from "@repo/backend/convex/contentRelease/finalize/spec";
import { runConvexProgram } from "@repo/backend/convex/lib/effect";
import {
  findTryoutRuntimeBundleByHash,
  loadTryoutRuntimeBundle,
} from "@repo/backend/convex/tryouts/runtime/signed";
import { v } from "convex/values";
import { Effect } from "effect";

const sourceValidator = v.object({
  rendererJson: v.string(),
  rendererManifestHash: v.string(),
});

export interface RendererSourceContract {
  readonly bundleHash: Sha256Hash;
  readonly rendererManifestHash: Sha256Hash;
}

const genesisRendererSource = {
  bundleHash: GENESIS_RENDERER_SOURCE_HASH,
  rendererManifestHash: genesisIdentity.rendererManifestHash,
} satisfies RendererSourceContract;

/** Loads the one authenticated permanent runtime that owns genesis renderer bytes. */
export const loadGenesisRendererSource = Effect.fn(
  "contentRelease.finalize.loadRendererSource"
)(function* (
  ctx: QueryCtx,
  contract: RendererSourceContract = genesisRendererSource
) {
  const stored = yield* findTryoutRuntimeBundleByHash(ctx, contract.bundleHash);
  if (
    !stored ||
    stored.bundleHash !== contract.bundleHash ||
    stored.rendererManifestHash !== contract.rendererManifestHash
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
  };
});

/** Returns only the already-authenticated renderer bytes needed by finalization. */
export const source = internalQuery({
  args: {},
  returns: sourceValidator,
  handler: (ctx) => runConvexProgram(loadGenesisRendererSource(ctx)),
});
