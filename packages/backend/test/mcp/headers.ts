/** Headers every JSON answer from the route carries, pinned as the wire spelling. */
export const JSON_RESPONSE_HEADERS = {
  "access-control-allow-headers":
    "accept,baggage,content-type,last-event-id,mcp-method,mcp-name,mcp-protocol-version,mcp-session-id,traceparent,tracestate",
  "access-control-allow-methods": "GET,POST,DELETE,OPTIONS",
  "access-control-allow-origin": "*",
  "access-control-expose-headers":
    "MCP-Protocol-Version,MCP-Session-ID,Retry-After",
  "cache-control": "no-store",
  "content-type": "application/json",
  vary: "Origin, Access-Control-Request-Headers",
};
