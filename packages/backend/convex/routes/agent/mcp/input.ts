import { parseContentLength, readBoundedBody } from "@repo/utilities/body";
import { isJsonContentType } from "@repo/utilities/mime";
import { Effect, Option, Schema } from "effect";

/** Nakafa policy ceiling for one JSON-RPC request, including batch payloads. */
export const MAX_MCP_REQUEST_BYTES = 64 * 1024;

/** Expected failure while bounding an MCP request before SDK classification. */
export class McpRequestBodyError extends Schema.TaggedError<McpRequestBodyError>()(
  "McpRequestBodyError",
  { reason: Schema.Literals(["invalid", "size"]) }
) {}

/** One bounded request plus its JSON value when parsing succeeded. */
export interface BoundedMcpRequest {
  readonly parsedBody?: unknown;
  readonly request: Request;
}

/** Reads a POST once and keeps every SDK classification path under the cap. */
export const readMcpRequest = Effect.fn("agent.mcp.readRequest")(function* (
  request: Request
) {
  if (request.method.toUpperCase() !== "POST") {
    return { request } satisfies BoundedMcpRequest;
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
    return { request } satisfies BoundedMcpRequest;
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
    return { request: bounded } satisfies BoundedMcpRequest;
  }

  const source = yield* Effect.try({
    catch: () => bodyError("invalid"),
    try: () => new TextDecoder("utf-8", { fatal: true }).decode(bytes),
  });
  const parsedBody =
    source.length === 0
      ? Option.none<unknown>()
      : yield* Effect.try({
          catch: () => undefined,
          try: () => JSON.parse(source) as unknown,
        }).pipe(Effect.option);
  return {
    ...(Option.isSome(parsedBody) ? { parsedBody: parsedBody.value } : {}),
    request: bounded,
  } satisfies BoundedMcpRequest;
});

/** Creates a sanitized body failure without retaining request bytes. */
function bodyError(reason: McpRequestBodyError["reason"]) {
  return new McpRequestBodyError({ reason });
}
