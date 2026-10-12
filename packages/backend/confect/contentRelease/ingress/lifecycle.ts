"use node";

import { verifySignedContentRelease } from "@nakafa/aksara-contracts/release/verify";
import { validateRendererManifestHash } from "@nakafa/aksara-contracts/renderer/manifest";
import type {
  ActivateRecoveryRequest,
  ActivateReleaseRequest,
  PublicationAbortRequest,
  PublicationAcceptRequest,
  VerifyReleaseRequest,
} from "@nakafa/aksara-contracts/transport/request";
import refs from "@repo/backend/confect/_generated/refs";
import {
  MutationRunner,
  QueryRunner,
} from "@repo/backend/confect/_generated/services";
import { releaseFail } from "@repo/backend/confect/contentRelease/error";
import {
  modelBuildCoordinatorLayer,
  waitForModelBuild,
} from "@repo/backend/confect/contentRelease/ingress/models";
import {
  decodeProofJson,
  decodeRendererJson,
} from "@repo/backend/confect/contentRelease/parse";
import { contractFailure } from "@repo/backend/confect/contentRelease/proof/failure";
import { Effect } from "effect";

type LifecycleRequest =
  | PublicationAcceptRequest
  | PublicationAbortRequest
  | VerifyReleaseRequest
  | ActivateReleaseRequest
  | ActivateRecoveryRequest;
type SignedRequest =
  | VerifyReleaseRequest
  | ActivateReleaseRequest
  | ActivateRecoveryRequest;
/** Authenticates one lifecycle request and its immutable release identity. */
function verifyRequest(request: SignedRequest) {
  return verifySignedContentRelease(request.release).pipe(
    Effect.mapError(contractFailure)
  );
}

/** Loads the renderer envelope bound to one exact authenticated release. */
const loadRenderer = Effect.fn("contentRelease.loadRenderer")(function* (
  release: SignedRequest["release"]
) {
  const { runQuery } = yield* QueryRunner;
  const envelope = yield* runQuery(refs.internal.contentRelease.envelope.get, {
    manifestHash: release.manifestHash,
    releaseId: release.manifest.releaseId,
  }).pipe(Effect.catchTag("SchemaError", Effect.die));
  const renderer = yield* decodeRendererJson(envelope.rendererJson);
  const validated = yield* validateRendererManifestHash(renderer).pipe(
    Effect.mapError(contractFailure)
  );
  if (release.manifest.rendererManifestHash !== validated.hash) {
    return yield* releaseFail(
      "CONTENT_RELEASE_INTEGRITY",
      "Lifecycle renderer does not match the signed release."
    );
  }
  return envelope.rendererJson;
});

/** Answers verification from the read-only status query, and writes only when proof must start or settle. */
const pollVerification = Effect.fn("contentRelease.pollVerification")(
  function* (manifestHash: string, releaseId: string) {
    const { runMutation } = yield* MutationRunner;
    const { runQuery } = yield* QueryRunner;
    const observed = yield* runQuery(
      refs.internal.contentRelease.proof.poll.status,
      {
        manifestHash,
        releaseId,
      }
    ).pipe(Effect.catchTag("SchemaError", Effect.die));
    if (observed.phase !== "pending") {
      return observed;
    }
    return yield* runMutation(refs.internal.contentRelease.proof.poll.poll, {
      manifestHash,
      releaseId,
    }).pipe(Effect.catchTag("SchemaError", Effect.die));
  }
);

/** Executes authenticated verification, activation, or recovery activation. */
export const advancePublication = Effect.fn(
  "contentRelease.advancePublication"
)(function* (request: LifecycleRequest) {
  const { runMutation } = yield* MutationRunner;
  if (request.operation === "accept") {
    const value = yield* runMutation(
      refs.internal.contentRelease.accept.accept,
      {
        recoveryId: request.recoveryId,
        releaseId: request.releaseId,
      }
    ).pipe(Effect.catchTag("SchemaError", Effect.die));
    return {
      ok: true,
      operation: request.operation,
      value,
    };
  }
  if (request.operation === "abort") {
    const value = yield* runMutation(
      refs.internal.contentRelease.manifest.abort,
      {
        releaseId: request.releaseId,
      }
    ).pipe(Effect.catchTag("SchemaError", Effect.die));
    return {
      ok: true,
      operation: request.operation,
      value,
    };
  }
  const release = yield* verifyRequest(request);
  const releaseId = release.manifest.releaseId;
  if (request.operation === "verify") {
    const result = yield* pollVerification(release.manifestHash, releaseId);
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
      value: {
        evidence,
        phase: result.phase,
      },
    };
  }
  const rendererJson = yield* loadRenderer(release);
  const coordinator = modelBuildCoordinatorLayer;
  if (request.operation === "activate") {
    const prepared = yield* runMutation(
      refs.internal.contentRelease.activate.prepare,
      {
        manifestHash: release.manifestHash,
        releaseId,
        rendererJson,
      }
    ).pipe(Effect.catchTag("SchemaError", Effect.die));
    if (prepared.kind === "prepared") {
      yield* waitForModelBuild(releaseId, "restart-failed-once").pipe(
        Effect.provide(coordinator)
      );
    }
    const result = yield* runMutation(
      refs.internal.contentRelease.activate.activate,
      {
        manifestHash: release.manifestHash,
        releaseId,
        rendererJson,
      }
    ).pipe(Effect.catchTag("SchemaError", Effect.die));
    return {
      ok: true,
      operation: request.operation,
      value: result.receipt,
    };
  }
  const prepared = yield* runMutation(
    refs.internal.contentRelease.activate.prepareRecovery,
    {
      manifestHash: release.manifestHash,
      releaseId,
      rendererJson,
    }
  ).pipe(Effect.catchTag("SchemaError", Effect.die));
  if (prepared.kind === "prepared") {
    yield* waitForModelBuild(releaseId, "restart-failed-once").pipe(
      Effect.provide(coordinator)
    );
  }
  const result = yield* runMutation(
    refs.internal.contentRelease.activate.activateRecovery,
    {
      manifestHash: release.manifestHash,
      releaseId,
      rendererJson,
    }
  ).pipe(Effect.catchTag("SchemaError", Effect.die));
  return {
    ok: true,
    operation: request.operation,
    value: result.receipt,
  };
});
