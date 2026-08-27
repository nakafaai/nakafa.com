"use node";

import type { PublicationRequest } from "@nakafa/aksara-contracts/transport/request";
import { verifyTryoutRuntimeBundleSource } from "@nakafa/aksara-contracts/tryout/runtime/source";
import { verifySignedTryoutRuntimeBundle } from "@nakafa/aksara-contracts/tryout/runtime/verify";
import type { ActionCtx } from "@repo/backend/convex/_generated/server";
import { callInternal } from "@repo/backend/convex/contentRelease/ingress/call";
import { loadStageEnvelope } from "@repo/backend/convex/contentRelease/ingress/envelope";
import { requireActiveContentKey } from "@repo/backend/convex/contentRelease/ingress/key";
import { contractFailure } from "@repo/backend/convex/contentRelease/proof/failure";
import {
  encodeRendererJson,
  encodeTryoutRuntimeBundleJson,
} from "@repo/backend/convex/contentRelease/wire";
import { makeFunctionReference } from "convex/server";
import { Effect } from "effect";

type RuntimeBundleRequest = Extract<
  PublicationRequest,
  { readonly operation: "stageTryoutRuntimeBundle" }
>;

const stageBundleReference = makeFunctionReference<
  "mutation",
  { bundleJson: string; rendererJson: string },
  {
    bundleHash: string;
    created: 0 | 1;
    releaseId: string;
    snapshotId: string;
    unchanged: 0 | 1;
  }
>("tryouts/runtime/signed:stageTryoutRuntimeBundle");

/** Authenticates and binds one permanent bundle to its staged Git release. */
export const stageTryoutRuntimeBundle = Effect.fn(
  "contentRelease.stageTryoutRuntimeBundle"
)(function* (
  ctx: ActionCtx,
  request: RuntimeBundleRequest,
  activeKeyId: string
) {
  const verified = yield* loadStageEnvelope(ctx, request.releaseId);
  const bundle = yield* verifySignedTryoutRuntimeBundle({
    bundle: request.bundle,
    rendererManifest: verified.renderer,
  }).pipe(Effect.mapError(contractFailure));
  yield* verifyTryoutRuntimeBundleSource({
    bundle,
    release: verified.signed,
  }).pipe(Effect.mapError(contractFailure));
  yield* requireActiveContentKey(
    bundle.keyId,
    activeKeyId,
    `Try-out runtime bundle ${bundle.bundleHash}`
  );
  return yield* callInternal(() =>
    ctx.runMutation(stageBundleReference, {
      bundleJson: encodeTryoutRuntimeBundleJson(bundle),
      rendererJson: encodeRendererJson(verified.renderer),
    })
  );
});
