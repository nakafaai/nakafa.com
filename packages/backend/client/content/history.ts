import "server-only";

import {
  type StoredProtectedRuntimeRequest,
  StoredProtectedRuntimeRequestSchema,
  StoredProtectedRuntimeResponseSchema,
  verifyStoredProtectedContentRuntimeExchange,
} from "@nakafa/aksara-contracts/history/decode";
import {
  MAX_PROTECTED_RUNTIME_REQUEST_BYTES,
  MAX_PROTECTED_RUNTIME_RESPONSE_BYTES,
} from "@nakafa/aksara-contracts/runtime/protected/limits";
import { ContentVerificationKeyResolver } from "@nakafa/aksara-contracts/signature/spec";
import {
  ContentRuntimeFailureError,
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
import { RETAINED_PROTECTED_CONTENT_RUNTIME_PATH } from "@repo/backend/content/endpoint";
import { contentKeyResolver } from "@repo/backend/content/trust";
import { Effect, Schema } from "effect";

/** One exact retained attempt has no immutable historical content response. */
export class RetainedContentRuntimeMissingError extends Schema.TaggedError<RetainedContentRuntimeMissingError>()(
  "RetainedContentRuntimeMissingError",
  { request: StoredProtectedRuntimeRequestSchema }
) {}

/** Reads one bounded retained-history response without trusting its body. */
const readRetainedRuntimeResponse = Effect.fn(
  "NakafaContent.readRetainedRuntimeResponse"
)(function* (response: Response, endpoint: string) {
  const input = yield* readContentResponse(
    response,
    endpoint,
    MAX_PROTECTED_RUNTIME_RESPONSE_BYTES
  );
  const decoded = yield* Schema.decodeUnknown(
    StoredProtectedRuntimeResponseSchema,
    { onExcessProperty: "error" }
  )(input).pipe(Effect.mapError(() => createContentContractError(response)));
  yield* validateContentRuntimeStatus(decoded, response.status);
  return decoded;
});

/** Reads and authenticates historical bodies for one exact retained attempt. */
export const readRetainedProtectedContent = Effect.fn(
  "NakafaContent.readRetainedProtectedContent"
)(function* (
  target: ContentHttpTarget,
  input: unknown,
  rendererManifest: unknown
) {
  const request: StoredProtectedRuntimeRequest = yield* Schema.decodeUnknown(
    StoredProtectedRuntimeRequestSchema,
    { onExcessProperty: "error" }
  )(input).pipe(
    Effect.mapError(() => new ContentTransportError({ reason: "request" }))
  );
  const source = yield* encodeContentRequest(
    request,
    MAX_PROTECTED_RUNTIME_REQUEST_BYTES
  );
  const endpoint = yield* createContentEndpoint(
    target.siteUrl,
    RETAINED_PROTECTED_CONTENT_RUNTIME_PATH
  );
  const response = yield* postContentRequest({ endpoint, source, target });
  const decoded = yield* readRetainedRuntimeResponse(response, endpoint);
  const verified = yield* verifyStoredProtectedContentRuntimeExchange({
    rendererManifest,
    request,
    response: decoded,
  }).pipe(
    Effect.provideService(ContentVerificationKeyResolver, contentKeyResolver),
    Effect.mapError((cause) => new ContentRuntimeVerificationError({ cause }))
  );
  if (verified.kind === "missing") {
    return yield* new RetainedContentRuntimeMissingError({ request });
  }
  if (verified.kind === "failure") {
    return yield* new ContentRuntimeFailureError({
      code: verified.code,
      status: response.status,
    });
  }
  return verified;
});
