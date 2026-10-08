import { type McpCase, modernPost } from "@repo/backend/test/mcp/harness";
import { JSON_RESPONSE_HEADERS } from "@repo/backend/test/mcp/headers";

/** Taxonomy calls: each deployment without a complete signed inventory answers its own failure. A managed success needs a material release that the route harness does not seed. */
export const TAXONOMY_CALL_CASES: readonly McpCase[] = [
  {
    answer: {
      body: {
        json: {
          result: {
            content: [
              {
                type: "text",
                text: '{"error":{"message":"Unable to read signed Nakafa material inventory.","suggestions":["Retry later using the same documented arguments."]}}',
              },
            ],
            structuredContent: {
              error: {
                message: "Unable to read signed Nakafa material inventory.",
                suggestions: [
                  "Retry later using the same documented arguments.",
                ],
              },
            },
            isError: true,
            resultType: "complete",
            _meta: {
              "io.modelcontextprotocol/serverInfo": {
                name: "nakafa-mcp-server",
                title: "Nakafa",
                version: "1.0.1",
              },
            },
          },
          jsonrpc: "2.0",
          id: 26,
        },
      },
      headers: JSON_RESPONSE_HEADERS,
      status: 200,
    },
    arrangement: "article",
    name: "nakafa_get_taxonomy reports a partly published deployment as unavailable",
    request: modernPost(
      26,
      "tools/call",
      { arguments: { locale: "en" }, name: "nakafa_get_taxonomy" },
      "nakafa_get_taxonomy"
    ),
  },
  {
    answer: {
      body: {
        json: {
          result: {
            content: [
              {
                type: "text",
                text: '{"error":{"message":"Unable to read signed Nakafa content inventory.","suggestions":["Retry later using the same documented arguments."]}}',
              },
            ],
            structuredContent: {
              error: {
                message: "Unable to read signed Nakafa content inventory.",
                suggestions: [
                  "Retry later using the same documented arguments.",
                ],
              },
            },
            isError: true,
            resultType: "complete",
            _meta: {
              "io.modelcontextprotocol/serverInfo": {
                name: "nakafa-mcp-server",
                title: "Nakafa",
                version: "1.0.1",
              },
            },
          },
          jsonrpc: "2.0",
          id: 22,
        },
      },
      headers: JSON_RESPONSE_HEADERS,
      status: 200,
    },
    name: "nakafa_get_taxonomy reports the unavailable publication from an empty deployment",
    request: modernPost(
      22,
      "tools/call",
      { arguments: { locale: "en" }, name: "nakafa_get_taxonomy" },
      "nakafa_get_taxonomy"
    ),
  },
  {
    answer: {
      body: {
        json: {
          result: {
            content: [
              {
                type: "text",
                text: '{"error":{"message":"Unable to read signed Nakafa article taxonomy.","suggestions":["Retry later using the same documented arguments."]}}',
              },
            ],
            structuredContent: {
              error: {
                message: "Unable to read signed Nakafa article taxonomy.",
                suggestions: [
                  "Retry later using the same documented arguments.",
                ],
              },
            },
            isError: true,
            resultType: "complete",
            _meta: {
              "io.modelcontextprotocol/serverInfo": {
                name: "nakafa-mcp-server",
                title: "Nakafa",
                version: "1.0.1",
              },
            },
          },
          jsonrpc: "2.0",
          id: 46,
        },
      },
      headers: JSON_RESPONSE_HEADERS,
      status: 200,
    },
    arrangement: "quran",
    name: "nakafa_get_taxonomy reports the missing article taxonomy of a Quran-only deployment",
    request: modernPost(
      46,
      "tools/call",
      { arguments: { locale: "en" }, name: "nakafa_get_taxonomy" },
      "nakafa_get_taxonomy"
    ),
  },
];
