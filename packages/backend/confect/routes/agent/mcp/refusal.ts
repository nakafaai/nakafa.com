import {
  mcpJsonRpcRefusal,
  readJsonRpcRequestId,
} from "@repo/backend/confect/routes/agent/mcp/response";
import { NAKAFA_MCP_PROTOCOL_VERSION } from "@repo/contents/agent/constants";
import { isJsonContentType } from "@repo/utilities/mime";
import { Array as Arr, HashSet, Option, Schema } from "effect";

const MCP_PROTOCOL_VERSION_HEADER = "mcp-protocol-version";
const PROTOCOL_VERSION_META_KEY = "io.modelcontextprotocol/protocolVersion";
const INVALID_REQUEST_CODE = -32_600;
const METHOD_NOT_ALLOWED_CODE = -32_000;
const METHOD_NOT_FOUND_CODE = -32_601;
const PARSE_ERROR_CODE = -32_700;
const UNSUPPORTED_PROTOCOL_VERSION_CODE = -32_022;

/**
 * Nakafa's transport rules, applied before the engine: the endpoint takes POST
 * only, with a JSON body that is one JSON-RPC 2.0 request, and it serves
 * protocol version 2026-07-28 only. The engine answers these refusals with a
 * different status, code, or body, so Nakafa answers them itself. Returns none
 * when the engine should answer. `parsedBody` is undefined when the body is
 * empty or is not JSON, which the body reader leaves unparsed.
 */
export function refuseMcpRequest(request: Request, parsedBody: unknown) {
  if (request.method !== "POST") {
    return Option.some(
      mcpJsonRpcRefusal(
        405,
        METHOD_NOT_ALLOWED_CODE,
        "Method not allowed.",
        null
      )
    );
  }
  if (!isJsonContentType(request.headers.get("content-type"))) {
    return Option.some(
      mcpJsonRpcRefusal(
        415,
        METHOD_NOT_ALLOWED_CODE,
        "Unsupported Media Type: Content-Type must be application/json",
        null
      )
    );
  }
  if (parsedBody === undefined) {
    return Option.some(
      mcpJsonRpcRefusal(
        400,
        PARSE_ERROR_CODE,
        "Parse error: the request body is not valid JSON",
        null
      )
    );
  }
  if (Arr.isArray(parsedBody)) {
    return Option.some(
      mcpJsonRpcRefusal(
        400,
        INVALID_REQUEST_CODE,
        "Bad Request: JSON-RPC batches may not contain requests for protocol revision 2026-07-28 or later",
        null
      )
    );
  }
  const responseId = readJsonRpcRequestId(parsedBody);
  if (!isJsonRpcMessage(parsedBody)) {
    return Option.some(
      mcpJsonRpcRefusal(
        400,
        INVALID_REQUEST_CODE,
        "Bad Request: the request body is not a valid JSON-RPC message",
        responseId
      )
    );
  }
  const requested = request.headers.get(MCP_PROTOCOL_VERSION_HEADER);
  if (
    requested !== null &&
    requested !== NAKAFA_MCP_PROTOCOL_VERSION &&
    !claimsProtocolVersion(parsedBody)
  ) {
    return Option.some(
      mcpJsonRpcRefusal(
        400,
        UNSUPPORTED_PROTOCOL_VERSION_CODE,
        `Unsupported protocol version: ${requested}`,
        responseId,
        {
          requested,
          supported: [NAKAFA_MCP_PROTOCOL_VERSION],
        }
      )
    );
  }
  return Option.none();
}

/** A JSON-RPC request: a method name and the string or number id it expects an answer for. */
const JsonRpcRequest = Schema.Struct({
  id: Schema.Union([Schema.String, Schema.Finite]),
  method: Schema.String,
});

/** The only methods Nakafa serves. The engine would serve more; every other method is refused here. */
const SERVED_METHODS = HashSet.fromIterable<string>([
  "server/discover",
  "tools/list",
  "tools/call",
  "resources/list",
  "resources/templates/list",
  "resources/read",
  "prompts/list",
  "prompts/get",
]);

/**
 * Refuses a request for a method Nakafa does not serve, before the engine sees
 * it, with the status, code, and message that Nakafa refuses an unknown method
 * with. Notifications never reach this check: they are acknowledged first.
 */
export function refuseUnservedMethod(parsedBody: unknown) {
  if (
    !Schema.is(JsonRpcRequest)(parsedBody) ||
    HashSet.has(SERVED_METHODS, parsedBody.method)
  ) {
    return Option.none();
  }
  return Option.some(
    mcpJsonRpcRefusal(
      404,
      METHOD_NOT_FOUND_CODE,
      "Method not found",
      readJsonRpcRequestId(parsedBody)
    )
  );
}

/** A JSON-RPC 2.0 request or notification: the version and a method name. */
const isJsonRpcMessage = Schema.is(
  Schema.Struct({ jsonrpc: Schema.Literal("2.0"), method: Schema.String })
);

/** Whether the body's own metadata names a protocol version, which the engine checks against the header. */
const claimsProtocolVersion = Schema.is(
  Schema.Struct({
    params: Schema.Struct({
      _meta: Schema.Struct({
        [PROTOCOL_VERSION_META_KEY]: Schema.Unknown,
      }),
    }),
  })
);
