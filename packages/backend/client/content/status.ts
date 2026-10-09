import type { ProtectedContentRuntimeFound } from "@nakafa/aksara-contracts/runtime/protected/spec";
import type {
  ContentRuntimeFailureSchema,
  ContentRuntimeMissingSchema,
} from "@nakafa/aksara-contracts/runtime/result";
import type { PublicContentRuntimeFound } from "@nakafa/aksara-contracts/runtime/spec";
import { ContentTransportError } from "@repo/backend/client/content/errors";
import { hasContentRuntimeMarker } from "@repo/backend/client/content/transport";
import { Effect } from "effect";
import type { HttpClientResponse } from "effect/http";

type ContentRuntimeStatus =
  | Pick<typeof ContentRuntimeFailureSchema.Type, "code" | "kind">
  | Pick<PublicContentRuntimeFound | ProtectedContentRuntimeFound, "kind">
  | Pick<typeof ContentRuntimeMissingSchema.Type, "kind">;

/** Classifies an out-of-contract JSON body without exposing its contents. */
export function createContentContractError(
  response: HttpClientResponse.HttpClientResponse
) {
  if (hasContentRuntimeMarker(response)) {
    return ContentTransportError.make({
      reason: "response-contract",
    });
  }
  return ContentTransportError.make({
    reason: "response-unmarked",
  });
}

/** Enforces the runtime endpoints' shared response and HTTP status pairs. */
export const validateContentRuntimeStatus = Effect.fn(
  "NakafaContent.validateContentRuntimeStatus"
)(function* (response: ContentRuntimeStatus, status: number) {
  if (response.kind === "found" && status === 200) {
    return;
  }
  if (response.kind === "missing" && status === 404) {
    return;
  }
  if (response.kind !== "failure") {
    return yield* ContentTransportError.make({
      reason: "status",
    });
  }
  if (response.code === "CONTENT_RUNTIME_UNAUTHORIZED" && status === 401) {
    return;
  }
  if (
    response.code === "CONTENT_RUNTIME_INVALID" &&
    (status === 400 || status === 413 || status === 415)
  ) {
    return;
  }
  if (
    (response.code === "CONTENT_RUNTIME_INTERNAL" ||
      response.code === "CONTENT_RUNTIME_RESPONSE_TOO_LARGE") &&
    status === 500
  ) {
    return;
  }
  return yield* ContentTransportError.make({
    reason: "status",
  });
});
