import {
  mcpJsonRpcRefusal,
  readJsonRpcRequestId,
} from "@repo/backend/confect/routes/agent/mcp/response";
import { NAKAFA_MCP_PROTOCOL_VERSION } from "@repo/contents/agent/constants";
import { isJsonContentType } from "@repo/utilities/mime";
import { Array as Arr, Option, Predicate, Schema } from "effect";

const MCP_PROTOCOL_VERSION_HEADER = "mcp-protocol-version";
const PROTOCOL_VERSION_META_KEY = "io.modelcontextprotocol/protocolVersion";
const INVALID_REQUEST_CODE = -32_600;
const METHOD_NOT_ALLOWED_CODE = -32_000;
const PARSE_ERROR_CODE = -32_700;
const UNSUPPORTED_PROTOCOL_VERSION_CODE = -32_022;

/**
 * Answers the refusals the engine would answer with another status, another
 * code, or no body, so clients keep the SDK's answer. Returns none when the
 * engine should answer. `parsedBody` is undefined when the body is empty or is
 * not JSON, which the body reader leaves unparsed.
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
  if (!(Predicate.isObject(parsedBody) && isJsonRpcMessage(parsedBody))) {
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

function isJsonRpcMessage(body: object) {
  return Predicate.hasProperty(body, "jsonrpc") && body.jsonrpc === "2.0";
}

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
