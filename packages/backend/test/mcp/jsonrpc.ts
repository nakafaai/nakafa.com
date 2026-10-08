import {
  jsonBody,
  MCP_CLIENT_META,
  type McpCase,
  modernPost,
} from "@repo/backend/test/mcp/harness";
import {
  BODYLESS_RESPONSE_HEADERS,
  JSON_RESPONSE_HEADERS,
} from "@repo/backend/test/mcp/headers";

/** JSON-RPC shape: malformed text, batches, missing members, unknown methods, and notifications. */
export const JSON_RPC_CASES: readonly McpCase[] = [
  {
    answer: {
      body: {
        json: {
          jsonrpc: "2.0",
          error: {
            code: -32_700,
            message: "Parse error: the request body is not valid JSON",
          },
          id: null,
        },
      },
      headers: JSON_RESPONSE_HEADERS,
      status: 400,
    },
    name: "malformed JSON is refused with the parse error",
    request: {
      body: "{",
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
            code: -32_600,
            message:
              "Bad Request: JSON-RPC batches may not contain requests for protocol revision 2026-07-28 or later",
          },
          id: null,
        },
      },
      headers: JSON_RESPONSE_HEADERS,
      status: 400,
    },
    name: "a batch array is refused as an invalid request",
    request: {
      body: jsonBody([
        {
          id: 81,
          jsonrpc: "2.0",
          method: "server/discover",
          params: { _meta: MCP_CLIENT_META },
        },
      ]),
      headers: {
        accept: "application/json, text/event-stream",
        "content-type": "application/json",
        "mcp-protocol-version": "2026-07-28",
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
            code: -32_600,
            message:
              "Bad Request: the request body is not a valid JSON-RPC message",
          },
          id: 82,
        },
      },
      headers: JSON_RESPONSE_HEADERS,
      status: 400,
    },
    name: "a request without the jsonrpc member is refused as an invalid request",
    request: {
      body: jsonBody({
        id: 82,
        method: "server/discover",
        params: { _meta: MCP_CLIENT_META },
      }),
      headers: {
        accept: "application/json, text/event-stream",
        "content-type": "application/json",
        "mcp-method": "server/discover",
        "mcp-protocol-version": "2026-07-28",
      },
      method: "POST",
    },
  },
  {
    answer: {
      body: {
        json: {
          jsonrpc: "2.0",
          id: 83,
          error: { code: -32_601, message: "Method not found" },
        },
      },
      headers: JSON_RESPONSE_HEADERS,
      status: 404,
    },
    name: "an unknown method is refused as method not found",
    request: modernPost(83, "unknown/method"),
  },
  {
    answer: {
      body: {
        json: {
          jsonrpc: "2.0",
          id: 84,
          error: { code: -32_601, message: "Method not found" },
        },
      },
      headers: JSON_RESPONSE_HEADERS,
      status: 404,
    },
    name: "a subscription request is refused as a method Nakafa does not serve",
    request: modernPost(84, "subscriptions/listen"),
  },
  {
    answer: {
      body: {
        json: {
          jsonrpc: "2.0",
          id: 85,
          error: { code: -32_601, message: "Method not found" },
        },
      },
      headers: JSON_RESPONSE_HEADERS,
      status: 404,
    },
    name: "a completion request is refused as a method Nakafa does not serve",
    request: modernPost(85, "completion/complete", {
      argument: { name: "locale", value: "e" },
      ref: { name: "nakafa_find_lesson", type: "ref/prompt" },
    }),
  },
  {
    answer: {
      body: { text: "" },
      headers: BODYLESS_RESPONSE_HEADERS,
      status: 202,
    },
    name: "a notification with the protocol version header is accepted without a body",
    request: {
      body: jsonBody({
        jsonrpc: "2.0",
        method: "notifications/initialized",
        params: { _meta: MCP_CLIENT_META },
      }),
      headers: {
        accept: "application/json, text/event-stream",
        "content-type": "application/json",
        "mcp-method": "notifications/initialized",
        "mcp-protocol-version": "2026-07-28",
      },
      method: "POST",
    },
  },
  {
    answer: {
      body: { text: "" },
      headers: BODYLESS_RESPONSE_HEADERS,
      status: 400,
    },
    name: "a notification without the protocol version header is refused without a body",
    request: {
      body: jsonBody({
        jsonrpc: "2.0",
        method: "notifications/initialized",
        params: { _meta: MCP_CLIENT_META },
      }),
      headers: {
        accept: "application/json, text/event-stream",
        "content-type": "application/json",
        "mcp-method": "notifications/initialized",
      },
      method: "POST",
    },
  },
];
