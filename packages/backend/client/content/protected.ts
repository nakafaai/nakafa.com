import {
  MAX_PROTECTED_RUNTIME_REQUEST_BYTES,
  MAX_PROTECTED_RUNTIME_RESPONSE_BYTES,
} from "@nakafa/aksara-contracts/runtime/protected/limits";
import {
  decodeProtectedContentRuntimeRequest,
  decodeProtectedContentRuntimeResponse,
  type ProtectedContentRuntimeRequest,
  type ProtectedContentRuntimeResponse,
} from "@nakafa/aksara-contracts/runtime/protected/spec";
import { verifyProtectedContentRuntimeExchange } from "@nakafa/aksara-contracts/runtime/protected/verify";
import { ContentVerificationKeyResolver } from "@nakafa/aksara-contracts/signature/spec";
import {
  type ContentHttpTarget,
  createContentEndpoint,
  encodeContentRequest,
} from "@repo/backend/client/content/endpoint";
import {
  ContentRuntimeFailureError,
  ContentRuntimeMissingError,
  ContentRuntimeVerificationError,
  ContentTransportError,
} from "@repo/backend/client/content/errors";
import {
  createContentContractError,
  validateContentRuntimeStatus,
} from "@repo/backend/client/content/status";
import {
  readContentResponse,
  requestContentResponse,
} from "@repo/backend/client/content/transport";
import { PROTECTED_CONTENT_RUNTIME_PATH } from "@repo/backend/content/endpoint";
import { contentKeyResolver } from "@repo/backend/content/trust";
import { Effect } from "effect";
import type { HttpClientResponse } from "effect/http";

/** Reads one protected response without trusting its advertised size or shape. */
const readProtectedRuntimeResponse = Effect.fn(
  "NakafaContent.readProtectedRuntimeResponse"
)(function* (
  response: HttpClientResponse.HttpClientResponse,
  endpoint: string
) {
  const input = yield* readContentResponse(
    response,
    endpoint,
    MAX_PROTECTED_RUNTIME_RESPONSE_BYTES
  );
  const decoded = yield* decodeProtectedContentRuntimeResponse(input).pipe(
    Effect.mapError(() => createContentContractError(response))
  );
  yield* validateContentRuntimeStatus(decoded, response.status);
  return decoded;
});

/** Reads and authenticates one retained-snapshot protected artifact batch. */
export const readProtectedContent = Effect.fn(
  "NakafaContent.readProtectedContent"
)(function* (
  target: ContentHttpTarget,
  input: unknown,
  rendererManifest: unknown
) {
  const request = yield* decodeProtectedContentRuntimeRequest(input).pipe(
    Effect.mapError(() =>
      ContentTransportError.make({
        reason: "request",
      })
    )
  );
  const source = yield* encodeContentRequest(
    request,
    MAX_PROTECTED_RUNTIME_REQUEST_BYTES
  );
  const endpoint = yield* createContentEndpoint(
    target.siteUrl,
    PROTECTED_CONTENT_RUNTIME_PATH
  );
  const { response, value: decoded } = yield* requestContentResponse(
    {
      endpoint,
      source,
      target,
    },
    readProtectedRuntimeResponse
  );
  return yield* verifyProtectedResponse(
    request,
    decoded,
    rendererManifest,
    response.status
  );
});

/** Verifies the signed protected exchange and preserves typed failures. */
const verifyProtectedResponse = Effect.fn(
  "NakafaContent.verifyProtectedResponse"
)(function* (
  request: ProtectedContentRuntimeRequest,
  decoded: ProtectedContentRuntimeResponse,
  rendererManifest: unknown,
  status: number
) {
  const verified = yield* verifyProtectedContentRuntimeExchange({
    rendererManifest,
    request,
    response: decoded,
  }).pipe(
    Effect.provideService(ContentVerificationKeyResolver, contentKeyResolver),
    Effect.mapError((cause) =>
      ContentRuntimeVerificationError.make({
        cause,
      })
    )
  );
  if (verified.kind === "missing") {
    return yield* ContentRuntimeMissingError.make({
      request,
    });
  }
  if (verified.kind === "failure") {
    return yield* ContentRuntimeFailureError.make({
      code: verified.code,
      status,
    });
  }
  return verified;
});
