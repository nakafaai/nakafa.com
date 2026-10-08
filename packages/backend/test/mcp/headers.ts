/** Headers of a bodyless answer from the route: CORS metadata and no-store, with no content type. */
export const BODYLESS_RESPONSE_HEADERS = {
  "access-control-allow-headers":
    "accept,baggage,content-type,last-event-id,mcp-method,mcp-name,mcp-protocol-version,mcp-session-id,traceparent,tracestate",
  "access-control-allow-methods": "GET,POST,DELETE,OPTIONS",
  "access-control-allow-origin": "*",
  "access-control-expose-headers":
    "MCP-Protocol-Version,MCP-Session-ID,Retry-After",
  "cache-control": "no-store",
  vary: "Origin, Access-Control-Request-Headers",
};

/** Headers of a JSON answer: the bodyless set plus its content type. */
export const JSON_RESPONSE_HEADERS = {
  ...BODYLESS_RESPONSE_HEADERS,
  "content-type": "application/json",
};

/** Headers of the route's own JSON errors, which Nakafa writes with an explicit charset. */
export const NAKAFA_JSON_ERROR_HEADERS = {
  ...BODYLESS_RESPONSE_HEADERS,
  "content-type": "application/json; charset=utf-8",
};
