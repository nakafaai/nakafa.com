import "server-only";

import {
  decodePublicContentRuntimeRequest,
  decodePublicContentRuntimeResponse,
  MAX_PUBLIC_RUNTIME_REQUEST_BYTES,
  MAX_PUBLIC_RUNTIME_RESPONSE_BYTES,
  type PublicContentRuntimeRequest,
  type PublicContentRuntimeResponse,
} from "@nakafa/aksara-contracts/runtime/spec";
import { verifyContentRuntimeExchange } from "@nakafa/aksara-contracts/runtime/verify";
import { ContentVerificationKeyResolver } from "@nakafa/aksara-contracts/signature/spec";
import {
  ContentRuntimeFailureError,
  ContentRuntimeMissingError,
  ContentRuntimeVerificationError,
  ContentTransportError,
} from "@repo/backend/client/content/errors";
import {
  type ContentHttpTarget,
  createContentContractError,
  createContentEndpoint,
  encodeContentRequest,
  postContentRequest,
  readContentResponse,
  validateContentRuntimeStatus,
} from "@repo/backend/client/content/transport";
import {
  MAX_PUBLIC_RUNTIME_BATCH_REQUEST_BYTES,
  MAX_PUBLIC_RUNTIME_BATCH_RESPONSE_BYTES,
  PublicContentRuntimeBatchRequestSchema,
  PublicContentRuntimeBatchResponseSchema,
} from "@repo/backend/content/batch";
import {
  PUBLIC_CONTENT_RUNTIME_BATCH_PATH,
  PUBLIC_CONTENT_RUNTIME_PATH,
} from "@repo/backend/content/endpoint";
import { contentKeyResolver } from "@repo/backend/content/trust";
import { Effect, Schema } from "effect";

/** Server-owned connection values for the private content runtime endpoint. */
export type ContentRuntimeTarget = ContentHttpTarget;

/** Public route identity without its module-owned delivery discriminator. */
export interface PublicContentRuntimeInput {
  readonly appLocale: PublicContentRuntimeRequest["appLocale"];
  readonly publicPath: string;
}

type PublicContentVerification =
  | { readonly kind: "frozen" }
  | { readonly kind: "live"; readonly rendererManifest: unknown };

/** Selects the renderer authority required by one public read capability. */
function getVerificationRenderer(
  verification: PublicContentVerification,
  response: PublicContentRuntimeResponse
) {
  if (verification.kind === "live") {
    return verification.rendererManifest;
  }
  if (response.kind === "found") {
    return response.rendererManifest;
  }
  return;
}

/** Reads one public response without trusting its advertised size or shape. */
const readPublicRuntimeResponse = Effect.fn(
  "NakafaContent.readPublicRuntimeResponse"
)(function* (response: Response, endpoint: string) {
  const input = yield* readContentResponse(
    response,
    endpoint,
    MAX_PUBLIC_RUNTIME_RESPONSE_BYTES
  );
  const decoded = yield* decodePublicContentRuntimeResponse(input).pipe(
    Effect.mapError(() => createContentContractError(response))
  );
  yield* validateContentRuntimeStatus(decoded, response.status);
  return decoded;
});

/** Verifies one exact Aksara response under the selected renderer policy. */
const verifyPublicContentResponse = Effect.fn(
  "NakafaContent.verifyPublicContentResponse"
)(function* (
  request: PublicContentRuntimeRequest,
  response: PublicContentRuntimeResponse,
  verification: PublicContentVerification,
  status: number
) {
  const rendererManifest = getVerificationRenderer(verification, response);
  const verified = yield* verifyContentRuntimeExchange({
    rendererManifest,
    request,
    response,
  }).pipe(
    Effect.provideService(ContentVerificationKeyResolver, contentKeyResolver),
    Effect.mapError((cause) => new ContentRuntimeVerificationError({ cause }))
  );
  if (verified.kind === "missing") {
    return yield* new ContentRuntimeMissingError({ request });
  }
  if (verified.kind === "failure") {
    return yield* new ContentRuntimeFailureError({
      code: verified.code,
      status,
    });
  }
  return verified;
});

/** Reads and authenticates one public artifact under an explicit renderer policy. */
const readPublicContentProgram = Effect.fn(
  "NakafaContent.readPublicContentProgram"
)(function* (
  target: ContentRuntimeTarget,
  input: PublicContentRuntimeInput,
  verification: PublicContentVerification
) {
  const request = yield* decodePublicContentRuntimeRequest({
    delivery: "public",
    ...input,
  }).pipe(
    Effect.mapError(() => new ContentTransportError({ reason: "request" }))
  );
  const source = yield* encodeContentRequest(
    request,
    MAX_PUBLIC_RUNTIME_REQUEST_BYTES
  );
  const endpoint = yield* createContentEndpoint(
    target.siteUrl,
    PUBLIC_CONTENT_RUNTIME_PATH
  );
  const response = yield* postContentRequest({ endpoint, source, target });
  const decoded = yield* readPublicRuntimeResponse(response, endpoint);
  return yield* verifyPublicContentResponse(
    request,
    decoded,
    verification,
    response.status
  );
});

/** Reads one batch response without trusting its outer wire contract. */
const readPublicRuntimeBatchResponse = Effect.fn(
  "NakafaContent.readPublicRuntimeBatchResponse"
)(function* (response: Response, endpoint: string) {
  const input = yield* readContentResponse(
    response,
    endpoint,
    MAX_PUBLIC_RUNTIME_BATCH_RESPONSE_BYTES
  );
  if (response.status !== 200) {
    const failure = yield* decodePublicContentRuntimeResponse(input).pipe(
      Effect.mapError(() => createContentContractError(response))
    );
    yield* validateContentRuntimeStatus(failure, response.status);
    if (failure.kind !== "failure") {
      return yield* createContentContractError(response);
    }
    return yield* new ContentRuntimeFailureError({
      code: failure.code,
      status: response.status,
    });
  }
  return yield* Schema.decodeUnknown(PublicContentRuntimeBatchResponseSchema)(
    input,
    { onExcessProperty: "error" }
  ).pipe(Effect.mapError(() => createContentContractError(response)));
});

/** Reads signed public evidence without claiming compatibility for execution. */
export const readPublicContentEvidence = Effect.fn(
  "NakafaContent.readPublicContentEvidence"
)(function* (target: ContentRuntimeTarget, input: PublicContentRuntimeInput) {
  return yield* readPublicContentProgram(target, input, { kind: "frozen" });
});

/** Reads and independently verifies one bounded batch of public artifacts. */
export const readPublicContentEvidenceBatch = Effect.fn(
  "NakafaContent.readPublicContentEvidenceBatch"
)(function* (
  target: ContentRuntimeTarget,
  inputs: readonly PublicContentRuntimeInput[]
) {
  const requests = yield* Effect.forEach(inputs, (input) =>
    decodePublicContentRuntimeRequest({ delivery: "public", ...input }).pipe(
      Effect.mapError(() => new ContentTransportError({ reason: "request" }))
    )
  );
  const batch = yield* Schema.decodeUnknown(
    PublicContentRuntimeBatchRequestSchema
  )({ requests }, { onExcessProperty: "error" }).pipe(
    Effect.mapError(() => new ContentTransportError({ reason: "request" }))
  );
  const source = yield* encodeContentRequest(
    batch,
    MAX_PUBLIC_RUNTIME_BATCH_REQUEST_BYTES
  );
  const endpoint = yield* createContentEndpoint(
    target.siteUrl,
    PUBLIC_CONTENT_RUNTIME_BATCH_PATH
  );
  const response = yield* postContentRequest({ endpoint, source, target });
  const decoded = yield* readPublicRuntimeBatchResponse(response, endpoint);
  if (decoded.responses.length !== requests.length) {
    return yield* createContentContractError(response);
  }
  return yield* Effect.forEach(requests, (request, index) =>
    Effect.gen(function* () {
      const batchResponse = decoded.responses[index];
      if (batchResponse === undefined) {
        return yield* createContentContractError(response);
      }
      return yield* verifyPublicContentResponse(
        request,
        batchResponse,
        { kind: "frozen" },
        response.status
      );
    })
  );
});

/** Reads one public artifact verified against the caller's live renderer. */
export const readPublicContent = Effect.fn("NakafaContent.readPublicContent")(
  function* (
    target: ContentRuntimeTarget,
    input: PublicContentRuntimeInput,
    rendererManifest: unknown
  ) {
    return yield* readPublicContentProgram(target, input, {
      kind: "live",
      rendererManifest,
    });
  }
);
