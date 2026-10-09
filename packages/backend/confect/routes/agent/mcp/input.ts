import { parseContentLength, readBoundedBody } from "@repo/utilities/body";
import { JsonTextSchema } from "@repo/utilities/json";
import { isJsonContentType } from "@repo/utilities/mime";
import { Effect, Option, Schema } from "effect";

/** Nakafa policy ceiling for one JSON-RPC request, including batch payloads. */
export const MAX_MCP_REQUEST_BYTES = 64 * 1024;

/** Expected failure while bounding an MCP request before protocol classification. */
export class McpRequestBodyError extends Schema.TaggedError<McpRequestBodyError>()(
  "McpRequestBodyError",
  {
    reason: Schema.Literals(["invalid", "size"]),
  }
) {}

/**
 * Reads a POST once and keeps every protocol classification path under the cap.
 * Answers the bounded request, with its JSON value as `parsedBody` when parsing
 * succeeded.
 */
export const readMcpRequest = Effect.fn("agent.mcp.readRequest")(function* (
  request: Request
) {
  if (request.method.toUpperCase() !== "POST") {
    return {
      request,
    };
  }
  const declaredLength = yield* parseContentLength(
    request.headers.get("content-length"),
    MAX_MCP_REQUEST_BYTES
  ).pipe(
    Effect.mapError((error) =>
      bodyError(error.reason === "limit" ? "size" : "invalid")
    )
  );
  if (!request.body) {
    if (declaredLength !== null && declaredLength !== 0) {
      return yield* bodyError("invalid");
    }
    return {
      request,
    };
  }
  const bytes = yield* readBoundedBody(
    request.body,
    MAX_MCP_REQUEST_BYTES
  ).pipe(
    Effect.mapError((error) =>
      bodyError(error._tag === "BodyLimitError" ? "size" : "invalid")
    )
  );
  if (declaredLength !== null && declaredLength !== bytes.byteLength) {
    return yield* bodyError("invalid");
  }
  const bounded = new Request(request.url, {
    body: new Uint8Array(bytes),
    headers: request.headers,
    method: request.method,
    signal: request.signal,
  });
  if (!isJsonContentType(request.headers.get("content-type"))) {
    return {
      request: bounded,
    };
  }
  const source = yield* Effect.try({
    catch: () => bodyError("invalid"),
    try: () =>
      new TextDecoder("utf-8", {
        fatal: true,
      }).decode(bytes),
  });
  const parsedBody =
    source.length === 0
      ? Option.none<unknown>()
      : Schema.decodeOption(JsonTextSchema)(source);
  return {
    ...(Option.isSome(parsedBody)
      ? {
          parsedBody: parsedBody.value,
        }
      : {}),
    request: bounded,
  };
});

/** Creates a sanitized body failure without retaining request bytes. */
function bodyError(reason: McpRequestBodyError["reason"]) {
  return new McpRequestBodyError({
    reason,
  });
}
