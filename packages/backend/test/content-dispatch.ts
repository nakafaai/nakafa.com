import { ContentVerificationKeyResolver } from "@nakafa/aksara-contracts/signature/spec";
import { PublicationResponseSchema } from "@nakafa/aksara-contracts/transport/response";
import { dispatchPublication } from "@repo/backend/convex/contentRelease/ingress/dispatch";
import type schema from "@repo/backend/convex/schema";
import {
  ingressArtifact,
  ingressItem,
  ingressProjection,
  ingressRecovery,
  ingressRecoveryId,
  ingressRecoveryItem,
  ingressRecoveryRoute,
  ingressRelease,
  ingressReleaseId,
  ingressRoute,
} from "@repo/backend/test/content-ingress";
import {
  TEST_KEY_ID,
  TEST_KEY_RESOLVER,
  TEST_PROOF_RENDERER,
} from "@repo/backend/test/content-proof";
import type { TestConvex } from "convex-test";
import { Effect, Schema } from "effect";

/** Executes one request through the real Node dispatcher and technical key. */
export async function sendPublication(
  target: TestConvex<typeof schema>,
  request: unknown
) {
  const source = JSON.stringify(request);
  const result = await target.action((ctx) =>
    Effect.runPromise(
      dispatchPublication(
        ctx,
        {
          byteLength: new TextEncoder().encode(source).byteLength,
          source,
        },
        TEST_KEY_ID
      ).pipe(
        Effect.provideService(ContentVerificationKeyResolver, TEST_KEY_RESOLVER)
      )
    )
  );
  return Schema.decodeUnknownSync(PublicationResponseSchema)(
    JSON.parse(result.body)
  );
}

/** Stages and verifies the authenticated technical candidate end to end. */
export function publishIngressCandidate(target: TestConvex<typeof schema>) {
  const requests = [
    {
      operation: "stageRelease",
      release: ingressRelease,
      rendererManifest: TEST_PROOF_RENDERER,
    },
    { operation: "current" },
    {
      batchIndex: 0,
      items: [ingressItem],
      operation: "stageItemBatch",
      releaseId: ingressReleaseId,
    },
    {
      batchIndex: 0,
      operation: "stageRouteBatch",
      releaseId: ingressReleaseId,
      routes: [ingressRoute],
    },
    {
      batchIndex: 0,
      operation: "stageProjectionBatch",
      projections: [ingressProjection],
      releaseId: ingressReleaseId,
    },
    {
      artifacts: [ingressArtifact],
      batchIndex: 0,
      operation: "stageArtifactBatch",
      releaseId: ingressReleaseId,
    },
    {
      manifestHash: ingressRelease.manifestHash,
      operation: "status",
      releaseId: ingressReleaseId,
    },
    { operation: "verify", release: ingressRelease },
    {
      afterIndex: -1,
      limit: 8,
      operation: "rollbackPage",
      rollbackOf: ingressReleaseId,
      rollbackOfManifestHash: ingressRelease.manifestHash,
    },
    {
      afterIndex: -1,
      limit: 100,
      operation: "routePage",
      rollbackOf: ingressReleaseId,
      rollbackOfManifestHash: ingressRelease.manifestHash,
    },
  ];
  return Effect.runPromise(
    Effect.forEach(requests, (request) =>
      Effect.promise(() => sendPublication(target, request))
    )
  );
}

/** Verifies, activates, and then activates the retained technical inverse. */
export function publishIngressRecovery(target: TestConvex<typeof schema>) {
  const requests = [
    {
      operation: "stageRecovery",
      release: ingressRecovery,
      rendererManifest: TEST_PROOF_RENDERER,
    },
    {
      batchIndex: 0,
      items: [ingressRecoveryItem],
      operation: "stageItemBatch",
      releaseId: ingressRecoveryId,
    },
    {
      batchIndex: 0,
      operation: "stageRouteBatch",
      releaseId: ingressRecoveryId,
      routes: [ingressRecoveryRoute],
    },
    { operation: "verify", release: ingressRecovery },
    {
      operation: "recovery",
      recoveryId: ingressRecoveryId,
      releaseId: ingressReleaseId,
    },
    { operation: "activate", release: ingressRelease },
    { operation: "current" },
    {
      activeManifestHash: ingressRelease.manifestHash,
      activeReleaseId: ingressReleaseId,
      cursor: null,
      family: "material",
      limit: 10,
      operation: "headPage",
    },
    { operation: "activateRecovery", release: ingressRecovery },
    {
      operation: "recovery",
      recoveryId: ingressRecoveryId,
      releaseId: ingressReleaseId,
    },
    { operation: "current" },
    {
      activeManifestHash: ingressRecovery.manifestHash,
      activeReleaseId: ingressRecoveryId,
      cursor: null,
      family: "material",
      limit: 10,
      operation: "headPage",
    },
  ];
  return Effect.runPromise(
    Effect.forEach(requests, (request) =>
      Effect.promise(() => sendPublication(target, request))
    )
  );
}
