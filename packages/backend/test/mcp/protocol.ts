import {
  jsonBody,
  MCP_CLIENT_META,
  type McpCase,
  modernPost,
  withHeaders,
} from "@repo/backend/test/mcp/harness";
import { JSON_RESPONSE_HEADERS } from "@repo/backend/test/mcp/headers";

/** Protocol headers: the version and method headers a modern request must carry, and the predecessor handshake. */
export const PROTOCOL_CASES: readonly McpCase[] = [
  {
    answer: {
      body: {
        json: {
          error: {
            code: -32_020,
            data: { request_id: "golden-request" },
            message:
              "The MCP-Protocol-Version header is required for modern requests.",
          },
          id: 31,
          jsonrpc: "2.0",
        },
      },
      headers: {
        "access-control-allow-headers":
          "accept,baggage,content-type,last-event-id,mcp-method,mcp-name,mcp-protocol-version,mcp-session-id,traceparent,tracestate",
        "access-control-allow-methods": "GET,POST,DELETE,OPTIONS",
        "access-control-allow-origin": "*",
        "access-control-expose-headers":
          "MCP-Protocol-Version,MCP-Session-ID,Retry-After",
        "cache-control": "no-store",
        "content-type": "application/json; charset=utf-8",
        vary: "Origin, Access-Control-Request-Headers",
      },
      status: 400,
    },
    name: "a modern request without MCP-Protocol-Version is refused with the header requirement",
    request: {
      body: jsonBody({
        id: 31,
        jsonrpc: "2.0",
        method: "server/discover",
        params: { _meta: MCP_CLIENT_META },
      }),
      headers: {
        accept: "application/json, text/event-stream",
        "content-type": "application/json",
        "mcp-method": "server/discover",
      },
      method: "POST",
    },
  },
  {
    answer: {
      body: {
        json: {
          jsonrpc: "2.0",
          error: {
            code: -32_020,
            message:
              "Bad Request: the request headers and body disagree: the body envelope names protocol version 2026-07-28 but the MCP-Protocol-Version header names 2099-01-01",
            data: {
              mismatch: {
                header: "2099-01-01",
                body: "the body envelope names protocol version 2026-07-28 but the MCP-Protocol-Version header names 2099-01-01",
              },
            },
          },
          id: 60,
        },
      },
      headers: JSON_RESPONSE_HEADERS,
      status: 400,
    },
    name: "a modern request for a version the server does not support is refused with the supported versions",
    request: withHeaders(modernPost(60, "server/discover"), {
      "mcp-protocol-version": "2099-01-01",
    }),
  },
  {
    answer: {
      body: {
        json: {
          jsonrpc: "2.0",
          error: {
            code: -32_020,
            message:
              "Bad Request: the request headers and body disagree: the body names method server/discover but the Mcp-Method header names tools/list",
            data: {
              mismatch: {
                header: "tools/list",
                body: "the body names method server/discover but the Mcp-Method header names tools/list",
              },
            },
          },
          id: 61,
        },
      },
      headers: JSON_RESPONSE_HEADERS,
      status: 400,
    },
    name: "an Mcp-Method header that differs from the body method is refused",
    request: withHeaders(modernPost(61, "server/discover"), {
      "mcp-method": "tools/list",
    }),
  },
  {
    answer: {
      body: {
        json: {
          jsonrpc: "2.0",
          error: {
            code: -32_020,
            message:
              'Bad Request: the request headers and body disagree: the body carries params.name="nakafa_get_taxonomy" but the Mcp-Name header names "nakafa_search_content"',
            data: {
              mismatch: {
                header: "nakafa_search_content",
                body: 'the body carries params.name="nakafa_get_taxonomy" but the Mcp-Name header names "nakafa_search_content"',
              },
            },
          },
          id: 62,
        },
      },
      headers: JSON_RESPONSE_HEADERS,
      status: 400,
    },
    name: "an Mcp-Name header that differs from the body tool name is refused",
    request: withHeaders(
      modernPost(
        62,
        "tools/call",
        {
          arguments: { locale: "en" },
          name: "nakafa_get_taxonomy",
        },
        "nakafa_get_taxonomy"
      ),
      { "mcp-name": "nakafa_search_content" }
    ),
  },
  {
    answer: {
      body: {
        json: {
          error: {
            code: -32_020,
            data: { request_id: "golden-request" },
            message:
              "The MCP-Protocol-Version header is required for modern requests.",
          },
          id: 30,
          jsonrpc: "2.0",
        },
      },
      headers: {
        "access-control-allow-headers":
          "accept,baggage,content-type,last-event-id,mcp-method,mcp-name,mcp-protocol-version,mcp-session-id,traceparent,tracestate",
        "access-control-allow-methods": "GET,POST,DELETE,OPTIONS",
        "access-control-allow-origin": "*",
        "access-control-expose-headers":
          "MCP-Protocol-Version,MCP-Session-ID,Retry-After",
        "cache-control": "no-store",
        "content-type": "application/json; charset=utf-8",
        vary: "Origin, Access-Control-Request-Headers",
      },
      status: 400,
    },
    name: "the predecessor 2025 initialize handshake without a protocol header is refused",
    request: {
      body: jsonBody({
        id: 30,
        jsonrpc: "2.0",
        method: "initialize",
        params: {
          capabilities: {},
          clientInfo: { name: "predecessor-test", version: "1.0.0" },
          protocolVersion: "2025-11-25",
        },
      }),
      headers: {
        accept: "application/json, text/event-stream",
        "content-type": "application/json",
      },
      method: "POST",
    },
  },
  {
    answer: {
      body: {
        json: {
          jsonrpc: "2.0",
          error: {
            code: -32_022,
            message: "Unsupported protocol version: 2025-11-25",
            data: { supported: ["2026-07-28"], requested: "2025-11-25" },
          },
          id: 30,
        },
      },
      headers: JSON_RESPONSE_HEADERS,
      status: 400,
    },
    name: "the predecessor 2025 initialize handshake with its own version header is refused",
    request: {
      body: jsonBody({
        id: 30,
        jsonrpc: "2.0",
        method: "initialize",
        params: {
          capabilities: {},
          clientInfo: { name: "predecessor-test", version: "1.0.0" },
          protocolVersion: "2025-11-25",
        },
      }),
      headers: {
        accept: "application/json, text/event-stream",
        "content-type": "application/json",
        "mcp-method": "initialize",
        "mcp-protocol-version": "2025-11-25",
      },
      method: "POST",
    },
  },
];
