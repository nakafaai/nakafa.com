"use node";

import { verifySignedContentArtifact } from "@nakafa/aksara-contracts/artifact/verify";
import { ACTIVE_SIGNING_KEY_ID } from "@nakafa/aksara-contracts/signature/trusted";
import type { StageOperation } from "@nakafa/aksara-contracts/transport/group";
import type { PublicationRequest } from "@nakafa/aksara-contracts/transport/request";
import type { ActionCtx } from "@repo/backend/convex/_generated/server";
import { releaseFail } from "@repo/backend/convex/contentRelease/error";
import { callInternal } from "@repo/backend/convex/contentRelease/ingress/call";
import {
  loadStageEnvelope,
  validateReleaseRenderer,
} from "@repo/backend/convex/contentRelease/ingress/envelope";
import { requireActiveContentKey } from "@repo/backend/convex/contentRelease/ingress/key";
import { stageTryoutRuntimeBundle } from "@repo/backend/convex/contentRelease/ingress/runtime/bundle";
import {
  stageSnapshot,
  stageSnapshotBatch,
} from "@repo/backend/convex/contentRelease/ingress/snapshot";
import { contractFailure } from "@repo/backend/convex/contentRelease/proof/failure";
import type {
  stageReceiptValidator,
  statusValidator,
} from "@repo/backend/convex/contentRelease/spec";
import {
  encodeArtifactJson,
  encodeItemJson,
  encodeProjectionJson,
  encodeReleaseJson,
  encodeRendererJson,
  encodeRouteJson,
} from "@repo/backend/convex/contentRelease/wire";
import { makeFunctionReference } from "convex/server";
import type { Infer } from "convex/values";
import { Effect } from "effect";

type StageRequest =
  | StageOperation
  | Extract<
      PublicationRequest,
      { readonly operation: "stageRecovery" | "stageRelease" }
    >;

type ReleaseRequest = Extract<
  StageRequest,
  { readonly operation: "stageRecovery" | "stageRelease" }
>;
type StageReceipt = Infer<typeof stageReceiptValidator>;
type Status = Infer<typeof statusValidator>;

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
const rollbackProjectionBatchReference = makeFunctionReference<
  "mutation",
  { batchIndex: number; projectionJson: string[]; releaseId: string },
  StageReceipt
>("contentRelease/items:stageRollbackProjectionBatch");
const artifactBatchReference = makeFunctionReference<
  "mutation",
  { artifactJson: string[]; batchIndex: number; releaseId: string },
  StageReceipt
>("contentRelease/artifacts:stageArtifactBatch");
/** Authenticates candidate and retained recovery artifacts against their keys. */
const verifyArtifactBatch = Effect.fn("contentRelease.verifyArtifactBatch")(
  function* (
    ctx: ActionCtx,
    request: Extract<StageRequest, { operation: "stageArtifactBatch" }>,
    activeKeyId: string
  ) {
    const verified = yield* loadStageEnvelope(ctx, request.releaseId);
    yield* Effect.forEach(
      request.artifacts,
      (artifact) => {
        const keyGate =
          verified.role === "candidate"
            ? requireActiveContentKey(
                artifact.keyId,
                activeKeyId,
                `Artifact ${artifact.artifactHash}`
              )
            : Effect.void;
        return keyGate.pipe(
          Effect.andThen(
            verifySignedContentArtifact({
              artifact,
              rendererContractVersion:
                verified.signed.manifest.rendererContractVersion,
              rendererManifest: verified.renderer,
            }).pipe(Effect.mapError(contractFailure))
          )
        );
      },
      { concurrency: "unbounded", discard: true }
    );
  }
);

/** Stages one authenticated candidate or its pre-staged recovery release. */
const stageRelease = Effect.fn("contentRelease.stageSignedRelease")(function* (
  ctx: ActionCtx,
  request: ReleaseRequest,
  activeKeyId: string
) {
  const { renderer, signed } = yield* validateReleaseRenderer(
    request.release,
    request.rendererManifest
  );
  yield* requireActiveContentKey(
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
    if (request.operation === "stageSnapshot") {
      const value = yield* stageSnapshot(ctx, request);
      return { ok: true, operation: request.operation, value };
    }
    if (request.operation === "stageSnapshotBatch") {
      const value = yield* stageSnapshotBatch(ctx, request);
      return { ok: true, operation: request.operation, value };
    }
    if (request.operation === "stageTryoutRuntimeBundle") {
      const value = yield* stageTryoutRuntimeBundle(ctx, request, activeKeyId);
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
    if (request.operation === "stageRollbackProjectionBatch") {
      const value = yield* callInternal(() =>
        ctx.runMutation(rollbackProjectionBatchReference, {
          batchIndex: request.batchIndex,
          projectionJson: request.projections.map(encodeProjectionJson),
          releaseId: request.releaseId,
        })
      );
      return { ok: true, operation: request.operation, value };
    }
    if (request.operation === "stageArtifactBatch") {
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
    return yield* releaseFail(
      "CONTENT_RELEASE_UNSUPPORTED",
      "Publication staging operation is not implemented."
    );
  }
);
