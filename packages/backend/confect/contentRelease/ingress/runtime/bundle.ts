"use node";

import type { StageTryoutRuntimeBundleRequest } from "@nakafa/aksara-contracts/transport/runtime";
import { verifyTryoutRuntimeBundleSource } from "@nakafa/aksara-contracts/tryout/runtime/source";
import { verifySignedTryoutRuntimeBundle } from "@nakafa/aksara-contracts/tryout/runtime/verify";
import refs from "@repo/backend/confect/_generated/refs";
import { MutationRunner } from "@repo/backend/confect/_generated/services";
import { loadStageEnvelope } from "@repo/backend/confect/contentRelease/ingress/envelope";
import { requireActiveContentKey } from "@repo/backend/confect/contentRelease/ingress/key";
import { contractFailure } from "@repo/backend/confect/contentRelease/proof/failure";
import {
  encodeRendererJson,
  encodeTryoutRuntimeBundleJson,
} from "@repo/backend/confect/contentRelease/wire";
import { Effect } from "effect";

/** Authenticates and binds one permanent bundle to its staged Git release. */
export const stageTryoutRuntimeBundle = Effect.fn(
  "contentRelease.stageTryoutRuntimeBundle"
)(function* (request: StageTryoutRuntimeBundleRequest, activeKeyId: string) {
  const { runMutation } = yield* MutationRunner;
  const verified = yield* loadStageEnvelope(request.releaseId);
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
  return yield* runMutation(
    refs.internal.tryouts.runtime.signed.stageTryoutRuntimeBundle,
    {
      bundleJson: encodeTryoutRuntimeBundleJson(bundle),
      rendererJson: encodeRendererJson(verified.renderer),
    }
  ).pipe(Effect.catchTag("SchemaError", Effect.die));
});
