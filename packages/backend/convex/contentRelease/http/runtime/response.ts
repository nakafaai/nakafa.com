import type { RuntimeHttpResult } from "@repo/backend/convex/contentRelease/runtime/result";

/** Builds one private JSON response shared by both runtime endpoints. */
export function privateRuntimeResponse(result: RuntimeHttpResult) {
  return new Response(result.body, {
    headers: {
      "cache-control": "private, no-store",
      "content-type": "application/json; charset=utf-8",
      "x-content-type-options": "nosniff",
    },
    status: result.status,
  });
}
