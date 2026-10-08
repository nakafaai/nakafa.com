import { type McpCase, modernPost } from "@repo/backend/test/mcp/harness";
import { JSON_RESPONSE_HEADERS } from "@repo/backend/test/mcp/headers";

/** Tool calls the SDK accepts whose options the Nakafa decoder refuses before any read. */
export const REFUSED_TOOL_CALL_CASES: readonly McpCase[] = [
  {
    answer: {
      body: {
        json: {
          result: {
            content: [
              {
                type: "text",
                text: '{"error":{"message":"Invalid Nakafa content search options.","suggestions":["Expected a value with a length of at least 1\\n  at [\\"queries\\"][0]"]}}',
              },
            ],
            structuredContent: {
              error: {
                message: "Invalid Nakafa content search options.",
                suggestions: [
                  'Expected a value with a length of at least 1\n  at ["queries"][0]',
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
          id: 38,
        },
      },
      headers: JSON_RESPONSE_HEADERS,
      status: 200,
    },
    name: "nakafa_search_content refuses a blank query before any read",
    request: modernPost(
      38,
      "tools/call",
      { arguments: { queries: [""] }, name: "nakafa_search_content" },
      "nakafa_search_content"
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
                text: '{"error":{"message":"Invalid Nakafa content search options.","suggestions":["Expected no excess property\\n  at [\\"unexpected\\"]"]}}',
              },
            ],
            structuredContent: {
              error: {
                message: "Invalid Nakafa content search options.",
                suggestions: [
                  'Expected no excess property\n  at ["unexpected"]',
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
          id: 39,
        },
      },
      headers: JSON_RESPONSE_HEADERS,
      status: 200,
    },
    name: "nakafa_search_content refuses an argument it does not declare",
    request: modernPost(
      39,
      "tools/call",
      {
        arguments: { queries: ["algebra"], unexpected: true },
        name: "nakafa_search_content",
      },
      "nakafa_search_content"
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
                text: '{"error":{"message":"Invalid Nakafa content read options.","suggestions":["Expected a Nakafa graph content ID, resource URI, or canonical URL.\\n  at [\\"content_ref\\"]"]}}',
              },
            ],
            structuredContent: {
              error: {
                message: "Invalid Nakafa content read options.",
                suggestions: [
                  'Expected a Nakafa graph content ID, resource URI, or canonical URL.\n  at ["content_ref"]',
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
          id: 40,
        },
      },
      headers: JSON_RESPONSE_HEADERS,
      status: 200,
    },
    name: "nakafa_get_content refuses a content_ref that is not a Nakafa reference",
    request: modernPost(
      40,
      "tools/call",
      {
        arguments: { content_ref: "not-a-reference" },
        name: "nakafa_get_content",
      },
      "nakafa_get_content"
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
                text: '{"error":{"message":"Invalid Nakafa taxonomy options.","suggestions":["Expected no excess property\\n  at [\\"unexpected\\"]"]}}',
              },
            ],
            structuredContent: {
              error: {
                message: "Invalid Nakafa taxonomy options.",
                suggestions: [
                  'Expected no excess property\n  at ["unexpected"]',
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
          id: 36,
        },
      },
      headers: JSON_RESPONSE_HEADERS,
      status: 200,
    },
    name: "nakafa_get_taxonomy rejects an argument it does not declare",
    request: modernPost(
      36,
      "tools/call",
      {
        arguments: { locale: "en", unexpected: true },
        name: "nakafa_get_taxonomy",
      },
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
                text: '{"error":{"message":"Invalid Nakafa Quran reference options.","suggestions":["Expected no excess property\\n  at [\\"unexpected\\"]"]}}',
              },
            ],
            structuredContent: {
              error: {
                message: "Invalid Nakafa Quran reference options.",
                suggestions: [
                  'Expected no excess property\n  at ["unexpected"]',
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
          id: 44,
        },
      },
      headers: JSON_RESPONSE_HEADERS,
      status: 200,
    },
    name: "nakafa_get_quran_reference refuses an argument it does not declare",
    request: modernPost(
      44,
      "tools/call",
      {
        arguments: { surah: 1, unexpected: true },
        name: "nakafa_get_quran_reference",
      },
      "nakafa_get_quran_reference"
    ),
  },
];
