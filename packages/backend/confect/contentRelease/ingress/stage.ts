"use node";

import { verifySignedContentArtifact } from "@nakafa/aksara-contracts/artifact/verify";
import { ACTIVE_SIGNING_KEY_ID } from "@nakafa/aksara-contracts/signature/trusted";
import type { StageArtifactBatchRequest } from "@nakafa/aksara-contracts/transport/batch";
import type { StageOperation } from "@nakafa/aksara-contracts/transport/group";
import type {
  StageRecoveryRequestSchema,
  StageReleaseRequestSchema,
} from "@nakafa/aksara-contracts/transport/request";
import refs from "@repo/backend/confect/_generated/refs";
import {
  MutationRunner,
  QueryRunner,
} from "@repo/backend/confect/_generated/services";
import {
  loadStageEnvelope,
  validateReleaseRenderer,
} from "@repo/backend/confect/contentRelease/ingress/envelope";
import { requireActiveContentKey } from "@repo/backend/confect/contentRelease/ingress/key";
import { stageTryoutRuntimeBundle } from "@repo/backend/confect/contentRelease/ingress/runtime/bundle";
import {
  stageSnapshot,
  stageSnapshotBatch,
} from "@repo/backend/confect/contentRelease/ingress/snapshot";
import { contractFailure } from "@repo/backend/confect/contentRelease/proof/failure";
import {
  encodeArtifactJson,
  encodeItemJson,
  encodeProjectionJson,
  encodeReleaseJson,
  encodeRendererJson,
  encodeRouteJson,
} from "@repo/backend/confect/contentRelease/wire";
import { Array as Arr, Effect } from "effect";

type ReleaseRequest =
  | typeof StageReleaseRequestSchema.Type
  | typeof StageRecoveryRequestSchema.Type;
type StageRequest = StageOperation | ReleaseRequest;
/** Authenticates candidate and recovery artifacts against their keys. */
const verifyArtifactBatch = Effect.fn("contentRelease.verifyArtifactBatch")(
  function* (request: StageArtifactBatchRequest, activeKeyId: string) {
    const verified = yield* loadStageEnvelope(request.releaseId);
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
              rendererManifest: verified.renderer,
            }).pipe(Effect.mapError(contractFailure))
          )
        );
      },
      {
        concurrency: "unbounded",
        discard: true,
      }
    );
  }
);

/** Stages one authenticated candidate or its pre-staged recovery release. */
const stageRelease = Effect.fn("contentRelease.stageSignedRelease")(function* (
  request: ReleaseRequest,
  activeKeyId: string
) {
  const { runMutation } = yield* MutationRunner;
  const { runQuery } = yield* QueryRunner;
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
    yield* runMutation(
      refs.internal.contentRelease.manifest.stageRelease,
      args
    ).pipe(Effect.catchTag("SchemaError", Effect.die));
  } else {
    yield* runMutation(
      refs.internal.contentRelease.manifest.stageRecovery,
      args
    ).pipe(Effect.catchTag("SchemaError", Effect.die));
  }
  return yield* runQuery(refs.internal.contentRelease.status.getStatus, {
    manifestHash: signed.manifestHash,
    releaseId: signed.manifest.releaseId,
  }).pipe(Effect.catchTag("SchemaError", Effect.die));
});

/** Executes one authenticated bounded idempotent staging operation. */
export const stagePublication = Effect.fn("contentRelease.stagePublication")(
  function* (request: StageRequest, activeKeyId = ACTIVE_SIGNING_KEY_ID) {
    const { runMutation } = yield* MutationRunner;
    if (
      request.operation === "stageRelease" ||
      request.operation === "stageRecovery"
    ) {
      const value = yield* stageRelease(request, activeKeyId);
      return {
        ok: true,
        operation: request.operation,
        value,
      };
    }
    if (request.operation === "stageSnapshot") {
      const value = yield* stageSnapshot(request);
      return {
        ok: true,
        operation: request.operation,
        value,
      };
    }
    if (request.operation === "stageSnapshotBatch") {
      const value = yield* stageSnapshotBatch(request);
      return {
        ok: true,
        operation: request.operation,
        value,
      };
    }
    if (request.operation === "stageTryoutRuntimeBundle") {
      const value = yield* stageTryoutRuntimeBundle(request, activeKeyId);
      return {
        ok: true,
        operation: request.operation,
        value,
      };
    }
    if (request.operation === "stageItemBatch") {
      const value = yield* runMutation(
        refs.internal.contentRelease.items.stageItemBatch,
        {
          batchIndex: request.batchIndex,
          itemJson: Arr.map(request.items, encodeItemJson),
          releaseId: request.releaseId,
        }
      ).pipe(Effect.catchTag("SchemaError", Effect.die));
      return {
        ok: true,
        operation: request.operation,
        value,
      };
    }
    if (request.operation === "stageRouteBatch") {
      const value = yield* runMutation(
        refs.internal.contentRelease.routes.stageRouteBatch,
        {
          batchIndex: request.batchIndex,
          releaseId: request.releaseId,
          routeJson: Arr.map(request.routes, encodeRouteJson),
        }
      ).pipe(Effect.catchTag("SchemaError", Effect.die));
      return {
        ok: true,
        operation: request.operation,
        value,
      };
    }
    if (request.operation === "stageProjectionBatch") {
      const value = yield* runMutation(
        refs.internal.contentRelease.items.stageProjectionBatch,
        {
          batchIndex: request.batchIndex,
          projectionJson: Arr.map(request.projections, encodeProjectionJson),
          releaseId: request.releaseId,
        }
      ).pipe(Effect.catchTag("SchemaError", Effect.die));
      return {
        ok: true,
        operation: request.operation,
        value,
      };
    }
    yield* verifyArtifactBatch(request, activeKeyId);
    const value = yield* runMutation(
      refs.internal.contentRelease.artifacts.stageArtifactBatch,
      {
        artifactJson: Arr.map(request.artifacts, encodeArtifactJson),
        batchIndex: request.batchIndex,
        releaseId: request.releaseId,
      }
    ).pipe(Effect.catchTag("SchemaError", Effect.die));
    return {
      ok: true,
      operation: request.operation,
      value,
    };
  }
);
