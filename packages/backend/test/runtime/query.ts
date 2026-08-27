import { ConvexRuntimeQueryError } from "@repo/backend/client/runtime";

/** Converts a rejected runtime-query fixture into the production error shape. */
export function toRuntimeQueryError(cause: unknown) {
  if (cause instanceof ConvexRuntimeQueryError) {
    return cause;
  }

  return new ConvexRuntimeQueryError({
    networkCodes: [],
    query: "test-runtime-query",
    reason: "query",
  });
}
