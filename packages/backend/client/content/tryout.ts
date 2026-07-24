import "server-only";

import {
  ContentTransportError,
  TryoutContentFailureError,
} from "@repo/backend/client/content/errors";
import {
  type ContentHttpTarget,
  createContentEndpoint,
  encodeContentRequest,
  postContentRequest,
  readContentResponse,
} from "@repo/backend/client/content/transport";
import {
  decodeTryoutContentRequest,
  decodeTryoutContentResponse,
  MAX_TRYOUT_CONTENT_REQUEST_BYTES,
  MAX_TRYOUT_CONTENT_RESPONSE_BYTES,
  type TryoutContentResponse,
} from "@repo/backend/content/tryout";
import { Effect } from "effect";

const TRYOUT_CONTENT_PATH = "/internal/tryouts/content";

/** Server and current-user credentials for private try-out content. */
export interface TryoutContentTarget extends ContentHttpTarget {
  readonly userToken: string;
}

/** Requires each response variant to use its exact private HTTP status. */
function validateTryoutStatus(response: TryoutContentResponse, status: number) {
  if (
    (response.kind === "found" || response.kind === "unavailable") &&
    status === 200
  ) {
    return Effect.void;
  }
  if (
    response.kind === "failure" &&
    ((response.code === "TRYOUT_CONTENT_INTERNAL" && status === 500) ||
      (response.code === "TRYOUT_CONTENT_UNAUTHORIZED" && status === 401) ||
      (response.code === "TRYOUT_CONTENT_INVALID" &&
        (status === 400 || status === 413 || status === 415)))
  ) {
    return Effect.void;
  }

  return Effect.fail(new ContentTransportError({ reason: "status" }));
}

/** Reads one attempt-owned section through the private Convex endpoint. */
export const readTryoutContent = Effect.fn("NakafaContent.readTryoutContent")(
  function* (target: TryoutContentTarget, input: unknown) {
    yield* encodeContentRequest(input, MAX_TRYOUT_CONTENT_REQUEST_BYTES);
    const request = yield* decodeTryoutContentRequest(input).pipe(
      Effect.mapError(() => new ContentTransportError({ reason: "request" }))
    );
    const source = JSON.stringify(request);
    const endpoint = yield* createContentEndpoint(
      target.siteUrl,
      TRYOUT_CONTENT_PATH
    );
    const response = yield* postContentRequest({
      endpoint,
      source,
      target,
      userToken: target.userToken,
    });
    const responseInput = yield* readContentResponse(
      response,
      endpoint,
      MAX_TRYOUT_CONTENT_RESPONSE_BYTES
    );
    const decoded = yield* decodeTryoutContentResponse(responseInput).pipe(
      Effect.mapError(() => new ContentTransportError({ reason: "json" }))
    );
    yield* validateTryoutStatus(decoded, response.status);

    if (decoded.kind === "failure") {
      return yield* new TryoutContentFailureError({
        code: decoded.code,
        status: response.status,
      });
    }
    if (decoded.kind === "unavailable") {
      return null;
    }

    return decoded;
  }
);
