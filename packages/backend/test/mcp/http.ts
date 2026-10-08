import {
  jsonBody,
  MCP_CLIENT_META,
  MCP_SECRET_HEADER,
  type McpCase,
  modernPost,
  withHeaders,
} from "@repo/backend/test/mcp/harness";
import { JSON_RESPONSE_HEADERS } from "@repo/backend/test/mcp/headers";

const JSON_ACCEPT = "application/json, text/event-stream";

/** HTTP shape: methods the endpoint does not serve, browser preflights, origins, media types, and the edge secret. */
export const HTTP_CASES: readonly McpCase[] = [
  {
    answer: {
      body: {
        json: {
          jsonrpc: "2.0",
          error: { code: -32_000, message: "Method not allowed." },
          id: null,
        },
      },
      headers: JSON_RESPONSE_HEADERS,
      status: 405,
    },
    name: "GET is refused as a method the endpoint does not serve",
    request: { method: "GET" },
  },
  {
    answer: {
      body: {
        json: {
          jsonrpc: "2.0",
          error: { code: -32_000, message: "Method not allowed." },
          id: null,
        },
      },
      headers: JSON_RESPONSE_HEADERS,
      status: 405,
    },
    name: "PUT is refused as a method the endpoint does not serve",
    request: { headers: { accept: JSON_ACCEPT }, method: "PUT" },
  },
  {
    answer: {
      body: {
        json: {
          jsonrpc: "2.0",
          error: { code: -32_000, message: "Method not allowed." },
          id: null,
        },
      },
      headers: JSON_RESPONSE_HEADERS,
      status: 405,
    },
    name: "DELETE is refused as a method the endpoint does not serve",
    request: { method: "DELETE" },
  },
  {
    answer: {
      body: { text: "" },
      headers: {
        "access-control-allow-credentials": "true",
        "access-control-allow-headers":
          "accept,baggage,content-type,last-event-id,mcp-method,mcp-name,mcp-protocol-version,mcp-session-id,traceparent,tracestate",
        "access-control-allow-methods": "GET,POST,DELETE,OPTIONS",
        "access-control-allow-origin": "https://nakafa.com",
        "access-control-expose-headers":
          "MCP-Protocol-Version,MCP-Session-ID,Retry-After",
        "cache-control": "no-store",
        vary: "Origin, Access-Control-Request-Headers",
      },
      status: 204,
    },
    name: "an OPTIONS preflight from an owned origin is answered with CORS metadata",
    request: {
      headers: { origin: "https://nakafa.com" },
      method: "OPTIONS",
    },
  },
  {
    answer: {
      body: { text: "" },
      headers: { "cache-control": "no-store" },
      status: 403,
    },
    name: "an OPTIONS preflight from an untrusted origin is refused without a body",
    request: {
      headers: { origin: "https://evil.example.com" },
      method: "OPTIONS",
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
        vary: "Origin, Access-Control-Request-Headers",
      },
      status: 204,
    },
    name: "an OPTIONS preflight without an Origin is answered for any origin",
    request: { method: "OPTIONS" },
  },
  {
    answer: {
      body: { text: "" },
      headers: { "cache-control": "no-store" },
      status: 403,
    },
    name: "a POST from an untrusted origin is refused before the transport",
    request: withHeaders(modernPost(90, "server/discover"), {
      origin: "https://evil.example.com",
    }),
  },
  {
    answer: {
      body: {
        json: {
          jsonrpc: "2.0",
          error: {
            code: -32_000,
            message:
              "Unsupported Media Type: Content-Type must be application/json",
          },
          id: null,
        },
      },
      headers: JSON_RESPONSE_HEADERS,
      status: 415,
    },
    name: "a POST with a media type that is not JSON is refused by the SDK",
    request: {
      body: jsonBody({
        id: 91,
        jsonrpc: "2.0",
        method: "server/discover",
        params: { _meta: MCP_CLIENT_META },
      }),
      headers: {
        accept: JSON_ACCEPT,
        "content-type": "text/plain",
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
          result: {
            supportedVersions: ["2026-07-28"],
            capabilities: {
              tools: { listChanged: true },
              resources: { listChanged: true },
              prompts: { listChanged: true },
            },
            instructions:
              "Use Nakafa for cited educational content, lessons, articles, try-outs, and reviewed Quran references. Search first. Pass content_id to the content tool only when the result includes markdown_url. Cite try-out catalog results by URL without requesting private attempt content. Every capability is public and read-only.",
            resultType: "complete",
            ttlMs: 0,
            cacheScope: "private",
            _meta: {
              "io.modelcontextprotocol/serverInfo": {
                name: "nakafa-mcp-server",
                title: "Nakafa",
                version: "1.0.1",
              },
            },
          },
          jsonrpc: "2.0",
          id: 92,
        },
      },
      headers: JSON_RESPONSE_HEADERS,
      status: 200,
    },
    name: "a POST whose Accept header omits application/json is refused by the SDK",
    request: withHeaders(modernPost(92, "server/discover"), {
      accept: "text/event-stream",
    }),
  },
  {
    answer: {
      body: {
        json: {
          result: {
            supportedVersions: ["2026-07-28"],
            capabilities: {
              tools: { listChanged: true },
              resources: { listChanged: true },
              prompts: { listChanged: true },
            },
            instructions:
              "Use Nakafa for cited educational content, lessons, articles, try-outs, and reviewed Quran references. Search first. Pass content_id to the content tool only when the result includes markdown_url. Cite try-out catalog results by URL without requesting private attempt content. Every capability is public and read-only.",
            resultType: "complete",
            ttlMs: 0,
            cacheScope: "private",
            _meta: {
              "io.modelcontextprotocol/serverInfo": {
                name: "nakafa-mcp-server",
                title: "Nakafa",
                version: "1.0.1",
              },
            },
          },
          jsonrpc: "2.0",
          id: 93,
        },
      },
      headers: JSON_RESPONSE_HEADERS,
      status: 200,
    },
    name: "a POST whose Accept header omits text/event-stream is refused by the SDK",
    request: withHeaders(modernPost(93, "server/discover"), {
      accept: "application/json",
    }),
  },
  {
    answer: {
      body: { text: "" },
      headers: { "cache-control": "no-store" },
      status: 403,
    },
    name: "a request without the edge secret is refused before the transport",
    request: { headers: { [MCP_SECRET_HEADER]: null }, method: "POST" },
  },
  {
    answer: {
      body: { text: "" },
      headers: { "cache-control": "no-store" },
      status: 403,
    },
    name: "a request with a wrong edge secret is refused before the transport",
    request: {
      headers: { [MCP_SECRET_HEADER]: "not-the-edge-secret" },
      method: "POST",
    },
  },
];
