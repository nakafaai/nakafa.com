import type { RuntimeHttpResult } from "@repo/backend/confect/contentRelease/runtime/result";
import {
  CONTENT_RUNTIME_RESPONSE_HEADER,
  CONTENT_RUNTIME_RESPONSE_MARKER,
} from "@repo/backend/content/endpoint";

/** Builds one private JSON response shared by all runtime endpoints. */
export function privateRuntimeResponse(result: RuntimeHttpResult) {
  return new Response(result.body, {
    headers: {
      [CONTENT_RUNTIME_RESPONSE_HEADER]: CONTENT_RUNTIME_RESPONSE_MARKER,
      "cache-control": "private, no-store",
      "content-type": "application/json; charset=utf-8",
      "x-content-type-options": "nosniff",
    },
    status: result.status,
  });
}
