import { RegisteredFunction } from "@confect/server";
import {
  RollbackSignedContentReleaseSchema,
  type SignedContentRelease,
} from "@nakafa/aksara-contracts/release";
import { ContentVerificationKeyResolver } from "@nakafa/aksara-contracts/signature/spec";
import {
  type PublicationRequest,
  PublicationRequestSchema,
} from "@nakafa/aksara-contracts/transport/request";
import { PublicationResponseSchema } from "@nakafa/aksara-contracts/transport/response";
import confectSchema from "@repo/backend/confect/_generated/schema";
import { dispatchPublication } from "@repo/backend/confect/contentRelease/ingress/dispatch";
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
} from "@repo/backend/test/content/ingress";
import {
  TEST_KEY_ID,
  TEST_KEY_RESOLVER,
  TEST_PROOF_RENDERER,
} from "@repo/backend/test/content/proof";
import { completeContentProof } from "@repo/backend/test/content/verify";
import { FetchClient } from "@repo/utilities/http/client";
import type { TestConvex } from "convex-test";
import { Effect, Layer, Schema } from "effect";

/** Validates one request against the publication contract, then encodes it as its wire body, rejecting undeclared keys. */
const encodeRequestJson = Schema.encodeSync(
  Schema.fromJsonString(PublicationRequestSchema),
  { onExcessProperty: "error" }
);
/** Decodes the dispatcher's response text through the response contract. */
const decodePublicationResponse = Schema.decodeUnknownSync(
  Schema.fromJsonString(PublicationResponseSchema)
);
/** The retained recovery fixture narrowed to its rollback origin, the only origin its stage and activation requests accept. */
const ingressRecoveryRelease = Schema.decodeSync(
  RollbackSignedContentReleaseSchema
)(ingressRecovery);

/** Executes one request through the real Node dispatcher and technical key. */
export async function sendPublication(
  target: TestConvex<typeof schema>,
  request: PublicationRequest
) {
  const source = encodeRequestJson(request);
  const result = await target.action((ctx) =>
    Effect.runPromise(
      dispatchPublication(
        {
          byteLength: new TextEncoder().encode(source).byteLength,
          source,
        },
        TEST_KEY_ID
      ).pipe(
        Effect.provideService(
          ContentVerificationKeyResolver,
          TEST_KEY_RESOLVER
        ),
        Effect.provide(
          Layer.provideMerge(
            FetchClient,
            RegisteredFunction.actionLayer(confectSchema, ctx)
          )
        )
      )
    )
  );
  return decodePublicationResponse(result.body);
}

/** Polls one durable ingress proof after its scheduled workflow completes. */
async function verifyPublication(
  target: TestConvex<typeof schema>,
  release: SignedContentRelease
) {
  await completeContentProof(
    target,
    release.manifestHash,
    release.manifest.releaseId
  );
  return sendPublication(target, {
    operation: "verify",
    release,
  });
}

/** Stages and verifies the authenticated technical candidate end to end. */
export async function publishIngressCandidate(
  target: TestConvex<typeof schema>
) {
  const requests = [
    {
      operation: "stageRelease",
      release: ingressRelease,
      rendererManifest: TEST_PROOF_RENDERER,
    },
    {
      operation: "current",
    },
    {
      operation: "stageGroup",
      releaseId: ingressReleaseId,
      requests: [
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
      ],
    },
    {
      manifestHash: ingressRelease.manifestHash,
      operation: "status",
      releaseId: ingressReleaseId,
    },
  ] satisfies PublicationRequest[];
  const responses = await Effect.runPromise(
    Effect.forEach(requests, (request) =>
      Effect.promise(() => sendPublication(target, request))
    )
  );
  responses.push(await verifyPublication(target, ingressRelease));
  const afterVerification = [
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
  ] satisfies PublicationRequest[];
  responses.push(
    ...(await Effect.runPromise(
      Effect.forEach(afterVerification, (request) =>
        Effect.promise(() => sendPublication(target, request))
      )
    ))
  );
  return responses;
}

/** Verifies, activates, and then activates the retained technical inverse. */
export async function publishIngressRecovery(
  target: TestConvex<typeof schema>
) {
  const staging = [
    {
      operation: "stageRecovery",
      release: ingressRecoveryRelease,
      rendererManifest: TEST_PROOF_RENDERER,
    },
    {
      operation: "stageGroup",
      releaseId: ingressRecoveryId,
      requests: [
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
      ],
    },
  ] satisfies PublicationRequest[];
  const responses = await Effect.runPromise(
    Effect.forEach(staging, (request) =>
      Effect.promise(() => sendPublication(target, request))
    )
  );
  responses.push(await verifyPublication(target, ingressRecovery));
  const afterVerification = [
    {
      operation: "recovery",
      recoveryId: ingressRecoveryId,
      releaseId: ingressReleaseId,
    },
    {
      operation: "activate",
      release: ingressRelease,
    },
    {
      operation: "current",
    },
    {
      activeManifestHash: ingressRelease.manifestHash,
      activeReleaseId: ingressReleaseId,
      cursor: null,
      family: "material",
      limit: 10,
      operation: "headPage",
    },
    {
      operation: "activateRecovery",
      release: ingressRecoveryRelease,
    },
    {
      operation: "recovery",
      recoveryId: ingressRecoveryId,
      releaseId: ingressReleaseId,
    },
    {
      operation: "current",
    },
    {
      activeManifestHash: ingressRecovery.manifestHash,
      activeReleaseId: ingressRecoveryId,
      cursor: null,
      family: "material",
      limit: 10,
      operation: "headPage",
    },
  ] satisfies PublicationRequest[];
  responses.push(
    ...(await Effect.runPromise(
      Effect.forEach(afterVerification, (request) =>
        Effect.promise(() => sendPublication(target, request))
      )
    ))
  );
  return responses;
}
