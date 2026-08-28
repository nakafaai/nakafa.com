import "server-only";

import {
  decodeProtectedContentRuntimeRequest,
  decodeProtectedContentRuntimeResponse,
} from "@nakafa/aksara-contracts/runtime/predecessor/spec";
import { verifyProtectedContentRuntimeExchange } from "@nakafa/aksara-contracts/runtime/predecessor/verify";
import {
  MAX_PROTECTED_RUNTIME_REQUEST_BYTES,
  MAX_PROTECTED_RUNTIME_RESPONSE_BYTES,
} from "@nakafa/aksara-contracts/runtime/protected/limits";
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
import { PREDECESSOR_PROTECTED_CONTENT_RUNTIME_PATH } from "@repo/backend/content/endpoint";
import { contentKeyResolver } from "@repo/backend/content/trust";
import { Effect } from "effect";

/** Reads one predecessor response without trusting its size or shape. */
const readPredecessorResponse = Effect.fn(
  "NakafaContent.readPredecessorRuntimeResponse"
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

/** Reads and authenticates one predecessor protected artifact batch. */
export const readPredecessorContent = Effect.fn(
  "NakafaContent.readPredecessorContent"
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
    PREDECESSOR_PROTECTED_CONTENT_RUNTIME_PATH
  );
  const { response, value: decoded } = yield* requestContentResponse(
    { endpoint, source, target },
    readPredecessorResponse
  );
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
      status: response.status,
    });
  }
  return verified;
});
