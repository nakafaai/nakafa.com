import "server-only";

import {
  MAX_PROTECTED_RUNTIME_REQUEST_BYTES,
  MAX_PROTECTED_RUNTIME_RESPONSE_BYTES,
} from "@nakafa/aksara-contracts/runtime/protected/limits";
import type {
  ProtectedContentRuntimeRequest,
  ProtectedContentRuntimeResponse,
} from "@nakafa/aksara-contracts/runtime/protected/spec";
import {
  decodeProtectedContentRuntimeRequest,
  decodeProtectedContentRuntimeResponse,
} from "@nakafa/aksara-contracts/runtime/protected/spec";
import { verifyProtectedContentRuntimeExchange } from "@nakafa/aksara-contracts/runtime/protected/verify";
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
  readContentResponse,
  requestContentResponse,
  validateContentRuntimeStatus,
} from "@repo/backend/client/content/transport";
import { PROTECTED_CONTENT_RUNTIME_PATH } from "@repo/backend/content/endpoint";
import { contentKeyResolver } from "@repo/backend/content/trust";
import { decodeProtectedRuntimeRow } from "@repo/backend/content/tryout/exchange";
import { readProtectedProgram } from "@repo/backend/content/tryout/protected";
import { Effect } from "effect";

/** Reads one protected response without trusting its advertised size or shape. */
const readProtectedRuntimeResponse = Effect.fn(
  "NakafaContent.readProtectedRuntimeResponse"
)(function* (response: Response, endpoint: string) {
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
    Effect.mapError(() => new ContentTransportError({ reason: "request" }))
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
    { endpoint, source, target },
    readProtectedRuntimeResponse
  );
  return yield* verifyProtectedResponse(
    request,
    decoded,
    rendererManifest,
    response.status
  );
});

/** Applies the same final signed exchange checks to both transports. */
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
/** Reads a retained protected artifact from an authenticated build snapshot. */
export const readSnapshotProtectedContent = Effect.fn(
  "NakafaContent.readSnapshotProtectedContent"
)(function* (input: unknown, rendererManifest: unknown) {
  const request = yield* decodeProtectedContentRuntimeRequest(input).pipe(
    Effect.mapError(() => new ContentTransportError({ reason: "request" }))
  );
  const row = yield* readProtectedProgram(request);
  const response = yield* decodeProtectedRuntimeRow(row, request).pipe(
    Effect.provideService(ContentVerificationKeyResolver, contentKeyResolver)
  );
  return yield* verifyProtectedResponse(
    request,
    response ?? { kind: "missing" },
    rendererManifest,
    response ? 200 : 404
  );
});
