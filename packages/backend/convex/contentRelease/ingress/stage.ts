"use node";

import { verifySignedContentArtifact } from "@nakafa/aksara-contracts/artifact/verify";
import type { SignedContentRelease } from "@nakafa/aksara-contracts/release";
import { verifySignedContentRelease } from "@nakafa/aksara-contracts/release/verify";
import { validateRendererManifestHash } from "@nakafa/aksara-contracts/renderer/manifest";
import { ACTIVE_SIGNING_KEY_ID } from "@nakafa/aksara-contracts/signature/trusted";
import type { PublicationRequest } from "@nakafa/aksara-contracts/transport/request";
import type { ActionCtx } from "@repo/backend/convex/_generated/server";
import { releaseFail } from "@repo/backend/convex/contentRelease/error";
import { callInternal } from "@repo/backend/convex/contentRelease/ingress/call";
import {
  decodeReleaseJson,
  decodeRendererJson,
  encodeArtifactJson,
  encodeItemJson,
  encodeProjectionJson,
  encodeReleaseJson,
  encodeRendererJson,
  encodeRouteJson,
} from "@repo/backend/convex/contentRelease/parse";
import { contractFailure } from "@repo/backend/convex/contentRelease/proof/failure";
import { hasRendererIdentity } from "@repo/backend/convex/contentRelease/renderer";
import type {
  stageReceiptValidator,
  statusValidator,
} from "@repo/backend/convex/contentRelease/spec";
import { makeFunctionReference } from "convex/server";
import type { Infer } from "convex/values";
import { Effect } from "effect";

type StageRequest = Extract<
  PublicationRequest,
  {
    readonly operation:
      | "stageArtifactBatch"
      | "stageItemBatch"
      | "stageProjectionBatch"
      | "stageRecovery"
      | "stageRelease"
      | "stageRouteBatch";
  }
>;

type ReleaseRequest = Extract<
  StageRequest,
  { readonly operation: "stageRecovery" | "stageRelease" }
>;
interface StoredEnvelope {
  readonly releaseJson: string;
  readonly rendererJson: string;
}
type StageReceipt = Infer<typeof stageReceiptValidator>;
type Status = Infer<typeof statusValidator>;

const releaseEnvelopeReference = makeFunctionReference<
  "query",
  { releaseId: string },
  StoredEnvelope
>("contentRelease/envelope:byRelease");
const stageReleaseReference = makeFunctionReference<
  "mutation",
  { releaseJson: string; rendererJson: string },
  Status
>("contentRelease/manifest:stageRelease");
const stageRecoveryReference = makeFunctionReference<
  "mutation",
  { releaseJson: string; rendererJson: string },
  Status
>("contentRelease/manifest:stageRecovery");
const statusReference = makeFunctionReference<
  "query",
  { manifestHash: string; releaseId: string },
  Status
>("contentRelease/status:getStatus");
const itemBatchReference = makeFunctionReference<
  "mutation",
  { batchIndex: number; itemJson: string[]; releaseId: string },
  StageReceipt
>("contentRelease/items:stageItemBatch");
const routeBatchReference = makeFunctionReference<
  "mutation",
  { batchIndex: number; releaseId: string; routeJson: string[] },
  StageReceipt
>("contentRelease/routes:stageRouteBatch");
const projectionBatchReference = makeFunctionReference<
  "mutation",
  { batchIndex: number; projectionJson: string[]; releaseId: string },
  StageReceipt
>("contentRelease/items:stageProjectionBatch");
const artifactBatchReference = makeFunctionReference<
  "mutation",
  { artifactJson: string[]; batchIndex: number; releaseId: string },
  StageReceipt
>("contentRelease/artifacts:stageArtifactBatch");

/** Rejects new publication bytes signed by a retained but inactive key. */
const requireActiveKey = Effect.fn("contentRelease.requireActiveKey")(
  function* (keyId: string, activeKeyId: string, subject: string) {
    if (keyId !== activeKeyId) {
      return yield* releaseFail(
        "CONTENT_RELEASE_UNSUPPORTED",
        `${subject} must use the active content signing key.`
      );
    }
  }
);

/** Authenticates one signed release through the code-owned trusted key set. */
function verifyRelease(release: SignedContentRelease) {
  return verifySignedContentRelease(release).pipe(
    Effect.mapError(contractFailure)
  );
}

/** Validates that one signed release owns the supplied renderer snapshot. */
const validateRenderer = Effect.fn("contentRelease.validateRenderer")(
  function* (
    release: ReleaseRequest["release"],
    rendererInput: ReleaseRequest["rendererManifest"]
  ) {
    const signed = yield* verifyRelease(release);
    const renderer = yield* validateRendererManifestHash(rendererInput).pipe(
      Effect.mapError(contractFailure)
    );
    if (!hasRendererIdentity(signed.manifest, renderer)) {
      return yield* releaseFail(
        "CONTENT_RELEASE_INTEGRITY",
        "Signed release does not own the supplied renderer snapshot."
      );
    }
    return { renderer, signed };
  }
);

/** Loads and verifies the release envelope owning one staged batch. */
const loadEnvelope = Effect.fn("contentRelease.loadStageEnvelope")(function* (
  ctx: ActionCtx,
  releaseId: string
) {
  const stored = yield* callInternal(() =>
    ctx.runQuery(releaseEnvelopeReference, { releaseId })
  );
  const release = yield* decodeReleaseJson(stored.releaseJson);
  const renderer = yield* decodeRendererJson(stored.rendererJson);
  const verified = yield* validateRenderer(release, renderer);
  if (verified.signed.manifest.releaseId !== releaseId) {
    return yield* releaseFail(
      "CONTENT_RELEASE_INTEGRITY",
      "Staged release identity does not match its stored envelope."
    );
  }
  return verified;
});

/** Authenticates every artifact against the frozen release renderer. */
const verifyArtifactBatch = Effect.fn("contentRelease.verifyArtifactBatch")(
  function* (
    ctx: ActionCtx,
    request: Extract<StageRequest, { operation: "stageArtifactBatch" }>,
    activeKeyId: string
  ) {
    const verified = yield* loadEnvelope(ctx, request.releaseId);
    yield* Effect.forEach(request.artifacts, (artifact) =>
      requireActiveKey(
        artifact.keyId,
        activeKeyId,
        `Artifact ${artifact.artifactHash}`
      ).pipe(
        Effect.andThen(
          verifySignedContentArtifact({
            artifact,
            rendererContractVersion:
              verified.signed.manifest.rendererContractVersion,
            rendererManifest: verified.renderer,
          }).pipe(Effect.mapError(contractFailure))
        )
      )
    );
  }
);

/** Stages one authenticated candidate or its pre-staged recovery release. */
const stageRelease = Effect.fn("contentRelease.stageSignedRelease")(function* (
  ctx: ActionCtx,
  request: ReleaseRequest,
  activeKeyId: string
) {
  const { renderer, signed } = yield* validateRenderer(
    request.release,
    request.rendererManifest
  );
  yield* requireActiveKey(
    signed.keyId,
    activeKeyId,
    `Release ${signed.manifest.releaseId}`
  );
  const args = {
    releaseJson: encodeReleaseJson(signed),
    rendererJson: encodeRendererJson(renderer),
  };
  if (request.operation === "stageRelease") {
    yield* callInternal(() => ctx.runMutation(stageReleaseReference, args));
  } else {
    yield* callInternal(() => ctx.runMutation(stageRecoveryReference, args));
  }
  return yield* callInternal(() =>
    ctx.runQuery(statusReference, {
      manifestHash: signed.manifestHash,
      releaseId: signed.manifest.releaseId,
    })
  );
});

/** Executes one authenticated bounded idempotent staging operation. */
export const stagePublication = Effect.fn("contentRelease.stagePublication")(
  function* (
    ctx: ActionCtx,
    request: StageRequest,
    activeKeyId = ACTIVE_SIGNING_KEY_ID
  ) {
    if (
      request.operation === "stageRelease" ||
      request.operation === "stageRecovery"
    ) {
      const value = yield* stageRelease(ctx, request, activeKeyId);
      return { ok: true, operation: request.operation, value };
    }
    if (request.operation === "stageItemBatch") {
      const value = yield* callInternal(() =>
        ctx.runMutation(itemBatchReference, {
          batchIndex: request.batchIndex,
          itemJson: request.items.map(encodeItemJson),
          releaseId: request.releaseId,
        })
      );
      return { ok: true, operation: request.operation, value };
    }
    if (request.operation === "stageRouteBatch") {
      const value = yield* callInternal(() =>
        ctx.runMutation(routeBatchReference, {
          batchIndex: request.batchIndex,
          releaseId: request.releaseId,
          routeJson: request.routes.map(encodeRouteJson),
        })
      );
      return { ok: true, operation: request.operation, value };
    }
    if (request.operation === "stageProjectionBatch") {
      const value = yield* callInternal(() =>
        ctx.runMutation(projectionBatchReference, {
          batchIndex: request.batchIndex,
          projectionJson: request.projections.map(encodeProjectionJson),
          releaseId: request.releaseId,
        })
      );
      return { ok: true, operation: request.operation, value };
    }
    yield* verifyArtifactBatch(ctx, request, activeKeyId);
    const value = yield* callInternal(() =>
      ctx.runMutation(artifactBatchReference, {
        artifactJson: request.artifacts.map(encodeArtifactJson),
        batchIndex: request.batchIndex,
        releaseId: request.releaseId,
      })
    );
    return { ok: true, operation: request.operation, value };
  }
);
