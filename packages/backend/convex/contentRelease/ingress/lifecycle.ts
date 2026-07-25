"use node";

import { verifySignedContentRelease } from "@nakafa/aksara-contracts/release/verify";
import { validateRendererManifestHash } from "@nakafa/aksara-contracts/renderer/manifest";
import type { PublicationRequest } from "@nakafa/aksara-contracts/transport/request";
import type { ActionCtx } from "@repo/backend/convex/_generated/server";
import { releaseFail } from "@repo/backend/convex/contentRelease/error";
import { callInternal } from "@repo/backend/convex/contentRelease/ingress/call";
import { decodeRendererJson } from "@repo/backend/convex/contentRelease/parse";
import { contractFailure } from "@repo/backend/convex/contentRelease/proof/failure";
import { recomputeProgram } from "@repo/backend/convex/contentRelease/proof/verify";
import { hasRendererIdentity } from "@repo/backend/convex/contentRelease/renderer";
import type {
  abortReceiptValidator,
  publicationReceiptValidator,
} from "@repo/backend/convex/contentRelease/spec";
import { makeFunctionReference } from "convex/server";
import type { Infer } from "convex/values";
import { Effect } from "effect";

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
type PublicationReceipt = Infer<typeof publicationReceiptValidator>;
interface SearchSyncResult {
  readonly complete: boolean;
  readonly processed: number;
}

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
const searchSyncReference = makeFunctionReference<
  "mutation",
  { releaseId: string },
  SearchSyncResult
>("contentRelease/search/sync:sync");

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

/** Resumes active-only search updates until the activated release is complete. */
const syncActiveSearch = Effect.fn("contentRelease.syncActiveSearch")(
  function* (ctx: ActionCtx, releaseId: string) {
    while (true) {
      const result = yield* callInternal(() =>
        ctx.runMutation(searchSyncReference, { releaseId })
      );
      if (result.complete) {
        return;
      }
      if (result.processed === 0) {
        return yield* releaseFail(
          "CONTENT_RELEASE_INTEGRITY",
          `Search sync ${releaseId} stopped without progress.`
        );
      }
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
    const value = yield* recomputeProgram(ctx, release.manifestHash, releaseId);
    return { ok: true, operation: request.operation, value };
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
    yield* syncActiveSearch(ctx, releaseId);
    return { ok: true, operation: request.operation, value };
  }
  const value = yield* callInternal(() =>
    ctx.runMutation(recoveryReference, {
      manifestHash: release.manifestHash,
      releaseId,
      rendererJson,
    })
  );
  yield* syncActiveSearch(ctx, releaseId);
  return { ok: true, operation: request.operation, value };
});
