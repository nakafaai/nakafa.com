import { jsonBody, type McpCase } from "@repo/backend/test/mcp/harness";

const BODYLESS_RESPONSE_HEADERS = {
  "access-control-allow-headers":
    "accept,baggage,content-type,last-event-id,mcp-method,mcp-name,mcp-protocol-version,mcp-session-id,traceparent,tracestate",
  "access-control-allow-methods": "GET,POST,DELETE,OPTIONS",
  "access-control-allow-origin": "*",
  "access-control-expose-headers":
    "MCP-Protocol-Version,MCP-Session-ID,Retry-After",
  "cache-control": "no-store",
  vary: "Origin, Access-Control-Request-Headers",
};

/** Limits: the body ceiling, the public-read budget, and an unavailable client identity. */
export const LIMIT_CASES: readonly McpCase[] = [
  {
    answer: {
      body: { text: "" },
      headers: BODYLESS_RESPONSE_HEADERS,
      status: 413,
    },
    name: "a declared body length above the ceiling is refused before the body is read",
    request: {
      headers: {
        "content-length": "65537",
        "content-type": "application/json",
      },
      method: "POST",
    },
  },
  {
    answer: {
      body: { text: "" },
      headers: BODYLESS_RESPONSE_HEADERS,
      status: 413,
    },
    name: "a streamed body that grows above the ceiling is refused without a JSON-RPC answer",
    request: {
      body: jsonBody({
        jsonrpc: "2.0",
        method: "notifications/initialized",
        padding: "x".repeat(65_537),
      }),
      headers: { "content-type": "application/json" },
      method: "POST",
    },
  },
  {
    answer: {
      body: { text: "" },
      headers: {
        "access-control-allow-headers":
          "accept,baggage,content-type,last-event-id,mcp-method,mcp-name,mcp-protocol-version,mcp-session-id,traceparent,tracestate",
        "access-control-allow-methods": "GET,POST,DELETE,OPTIONS",
        "access-control-allow-origin": "*",
        "access-control-expose-headers":
          "MCP-Protocol-Version,MCP-Session-ID,Retry-After",
        "cache-control": "no-store",
        "retry-after": "1",
        vary: "Origin, Access-Control-Request-Headers",
      },
      status: 429,
    },
    arrangement: "public-read-spent",
    name: "a caller past its public-read budget is refused with a retry delay and no body",
    request: {
      body: jsonBody({
        jsonrpc: "2.0",
        method: "notifications/initialized",
      }),
      headers: { "content-type": "application/json" },
      method: "POST",
    },
  },
  {
    answer: {
      body: { text: "" },
      headers: BODYLESS_RESPONSE_HEADERS,
      status: 503,
    },
    name: "a request whose client identity is unavailable is refused without a body",
    request: {
      body: jsonBody({
        jsonrpc: "2.0",
        method: "notifications/initialized",
      }),
      headers: {
        "content-type": "application/json",
        "x-forwarded-for": "",
      },
      method: "POST",
    },
  },
];
