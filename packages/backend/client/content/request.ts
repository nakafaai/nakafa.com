import "server-only";

import {
  type ContentRuntimeRequest,
  type ContentRuntimeResponse,
  decodeContentRuntimeRequest,
  decodeContentRuntimeResponse,
  MAX_RUNTIME_REQUEST_BYTES,
  MAX_RUNTIME_RESPONSE_BYTES,
} from "@nakafa/aksara-contracts/runtime/spec";
import { ContentTransportError } from "@repo/backend/client/content/errors";
import {
  type ContentHttpTarget,
  createContentEndpoint,
  encodeContentRequest,
  postContentRequest,
  readContentResponse,
} from "@repo/backend/client/content/transport";
import { Effect } from "effect";

const RUNTIME_PATH = "/internal/content/runtime";

/** Server-owned connection values for the private content runtime endpoint. */
export type PublicContentTarget = ContentHttpTarget;

/** One decoded server-runtime exchange before cryptographic verification. */
export interface ContentRuntimeExchange {
  readonly request: ContentRuntimeRequest;
  readonly response: ContentRuntimeResponse;
  readonly status: number;
}

/** Enforces the endpoint's exact status vocabulary for each response variant. */
function validateRuntimeStatus(
  response: ContentRuntimeResponse,
  status: number
) {
  if (response.kind === "found" && status === 200) {
    return Effect.void;
  }
  if (response.kind === "missing" && status === 404) {
    return Effect.void;
  }
  if (
    response.kind === "failure" &&
    ((response.code === "CONTENT_RUNTIME_INTERNAL" && status === 500) ||
      (response.code === "CONTENT_RUNTIME_INVALID" &&
        (status === 400 || status === 413 || status === 415)) ||
      (response.code === "CONTENT_RUNTIME_UNAUTHORIZED" && status === 401))
  ) {
    return Effect.void;
  }

  return Effect.fail(new ContentTransportError({ reason: "status" }));
}

/** Decodes one bounded response through the exact public runtime contract. */
const readRuntimeResponse = Effect.fn("NakafaContent.readRuntimeResponse")(
  function* (response: Response, endpoint: string) {
    const input = yield* readContentResponse(
      response,
      endpoint,
      MAX_RUNTIME_RESPONSE_BYTES
    );
    const decoded = yield* decodeContentRuntimeResponse(input).pipe(
      Effect.mapError(() => new ContentTransportError({ reason: "json" }))
    );
    yield* validateRuntimeStatus(decoded, response.status);

    return decoded;
  }
);

/** Posts one exact public request through the private bounded Convex seam. */
export const fetchPublicContentRuntime = Effect.fn(
  "NakafaContent.fetchPublicContentRuntime"
)(function* (target: PublicContentTarget, input: unknown) {
  yield* encodeContentRequest(input, MAX_RUNTIME_REQUEST_BYTES);
  const request = yield* decodeContentRuntimeRequest(input).pipe(
    Effect.mapError(() => new ContentTransportError({ reason: "request" }))
  );
  if (request.delivery !== "public") {
    return yield* new ContentTransportError({ reason: "delivery" });
  }

  const source = JSON.stringify(request);
  const endpoint = yield* createContentEndpoint(target.siteUrl, RUNTIME_PATH);
  const response = yield* postContentRequest({
    endpoint,
    source,
    target,
  });
  const decoded = yield* readRuntimeResponse(response, endpoint);

  return {
    request,
    response: decoded,
    status: response.status,
  } satisfies ContentRuntimeExchange;
});
