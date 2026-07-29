"use node";

import { verifySignedContentRelease } from "@nakafa/aksara-contracts/release/verify";
import { validateRendererManifestHash } from "@nakafa/aksara-contracts/renderer/manifest";
import type { PublicationRequest } from "@nakafa/aksara-contracts/transport/request";
import type { ActionCtx } from "@repo/backend/convex/_generated/server";
import { releaseFail } from "@repo/backend/convex/contentRelease/error";
import { callInternal } from "@repo/backend/convex/contentRelease/ingress/call";
import type { ReadModelStatus } from "@repo/backend/convex/contentRelease/models";
import {
  decodeProofJson,
  decodeRendererJson,
} from "@repo/backend/convex/contentRelease/parse";
import { contractFailure } from "@repo/backend/convex/contentRelease/proof/failure";
import type { proofPollValidator } from "@repo/backend/convex/contentRelease/proof/spec";
import { hasRendererIdentity } from "@repo/backend/convex/contentRelease/renderer";
import type {
  abortReceiptValidator,
  publicationReceiptValidator,
} from "@repo/backend/convex/contentRelease/spec";
import { makeFunctionReference } from "convex/server";
import type { Infer } from "convex/values";
import { Duration, Effect } from "effect";

type LifecycleRequest = Extract<
  PublicationRequest,
  {
    readonly operation:
      | "accept"
      | "abort"
      | "activate"
      | "activateRecovery"
      | "verify";
  }
>;

type SignedRequest = Exclude<
  LifecycleRequest,
  { readonly operation: "abort" | "accept" }
>;
interface StoredEnvelope {
  readonly releaseJson: string;
  readonly rendererJson: string;
}
type AbortReceipt = Infer<typeof abortReceiptValidator>;
type ProofPoll = Infer<typeof proofPollValidator>;
type PublicationReceipt = Infer<typeof publicationReceiptValidator>;
const envelopeReference = makeFunctionReference<
  "query",
  { manifestHash: string; releaseId: string },
  StoredEnvelope
>("contentRelease/envelope:get");
const acceptReference = makeFunctionReference<
  "mutation",
  { recoveryId: string; releaseId: string },
  AbortReceipt
>("contentRelease/accept:accept");
const abortReference = makeFunctionReference<
  "mutation",
  { releaseId: string },
  AbortReceipt
>("contentRelease/manifest:abort");
const activateReference = makeFunctionReference<
  "mutation",
  { manifestHash: string; releaseId: string; rendererJson: string },
  PublicationReceipt
>("contentRelease/activate:activate");
const recoveryReference = makeFunctionReference<
  "mutation",
  { manifestHash: string; releaseId: string; rendererJson: string },
  PublicationReceipt
>("contentRelease/activate:activateRecovery");
const modelStatusReference = makeFunctionReference<
  "query",
  { releaseId: string },
  ReadModelStatus
>("contentRelease/models:status");
const proofPollReference = makeFunctionReference<
  "mutation",
  { manifestHash: string; releaseId: string },
  ProofPoll
>("contentRelease/proof/poll:poll");

/** Authenticates one lifecycle request and its immutable release identity. */
function verifyRequest(request: SignedRequest) {
  return verifySignedContentRelease(request.release).pipe(
    Effect.mapError(contractFailure)
  );
}

/** Loads the renderer envelope bound to one exact authenticated release. */
const loadRenderer = Effect.fn("contentRelease.loadRenderer")(function* (
  ctx: ActionCtx,
  release: SignedRequest["release"]
) {
  const envelope = yield* callInternal(() =>
    ctx.runQuery(envelopeReference, {
      manifestHash: release.manifestHash,
      releaseId: release.manifest.releaseId,
    })
  );
  const renderer = yield* decodeRendererJson(envelope.rendererJson);
  const validated = yield* validateRendererManifestHash(renderer).pipe(
    Effect.mapError(contractFailure)
  );
  if (!hasRendererIdentity(release.manifest, validated)) {
    return yield* releaseFail(
      "CONTENT_RELEASE_INTEGRITY",
      "Lifecycle renderer does not match the signed release."
    );
  }
  return envelope.rendererJson;
});

/** Waits until the single durable model lineage converges or fails visibly. */
const waitForReadModels = Effect.fn("contentRelease.waitForReadModels")(
  function* (ctx: ActionCtx, releaseId: string) {
    while (true) {
      const status = yield* callInternal(() =>
        ctx.runQuery(modelStatusReference, { releaseId })
      );
      if (status.phase === "completed") {
        return;
      }
      if (status.phase === "failed") {
        return yield* releaseFail(
          "CONTENT_RELEASE_INTEGRITY",
          `Read-model sync ${releaseId} failed before completion.`
        );
      }
      yield* Effect.sleep(Duration.millis(100));
    }
  }
);

/** Executes authenticated verification, activation, or recovery activation. */
export const advancePublication = Effect.fn(
  "contentRelease.advancePublication"
)(function* (ctx: ActionCtx, request: LifecycleRequest) {
  if (request.operation === "accept") {
    const value = yield* callInternal(() =>
      ctx.runMutation(acceptReference, {
        recoveryId: request.recoveryId,
        releaseId: request.releaseId,
      })
    );
    return { ok: true, operation: request.operation, value };
  }
  if (request.operation === "abort") {
    const value = yield* callInternal(() =>
      ctx.runMutation(abortReference, {
        releaseId: request.releaseId,
      })
    );
    return { ok: true, operation: request.operation, value };
  }
  const release = yield* verifyRequest(request);
  const releaseId = release.manifest.releaseId;
  if (request.operation === "verify") {
    const result = yield* callInternal(() =>
      ctx.runMutation(proofPollReference, {
        manifestHash: release.manifestHash,
        releaseId,
      })
    );
    if (result.phase === "failed") {
      return yield* releaseFail(
        "CONTENT_RELEASE_INTEGRITY",
        `Content release ${releaseId} proof workflow ${result.reason}.`
      );
    }
    if (result.phase === "verifying") {
      return {
        ok: true,
        operation: request.operation,
        value: {
          manifestHash: release.manifestHash,
          phase: result.phase,
          releaseId,
        },
      };
    }
    const evidence = yield* decodeProofJson(result.proofJson);
    return {
      ok: true,
      operation: request.operation,
      value: { evidence, phase: result.phase },
    };
  }
  const rendererJson = yield* loadRenderer(ctx, release);
  if (request.operation === "activate") {
    const value = yield* callInternal(() =>
      ctx.runMutation(activateReference, {
        manifestHash: release.manifestHash,
        releaseId,
        rendererJson,
      })
    );
    yield* waitForReadModels(ctx, releaseId);
    return { ok: true, operation: request.operation, value };
  }
  const value = yield* callInternal(() =>
    ctx.runMutation(recoveryReference, {
      manifestHash: release.manifestHash,
      releaseId,
      rendererJson,
    })
  );
  yield* waitForReadModels(ctx, releaseId);
  return { ok: true, operation: request.operation, value };
});
