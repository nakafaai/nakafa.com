import { type McpCase, modernPost } from "@repo/backend/test/mcp/harness";
import { JSON_RESPONSE_HEADERS } from "@repo/backend/test/mcp/headers";

/** Tool calls with invalid arguments or an unknown name: the request is refused before any read. */
export const INVALID_TOOL_CALL_CASES: readonly McpCase[] = [
  {
    answer: {
      body: {
        json: {
          result: {
            content: [
              {
                type: "text",
                text: "Input validation error: Invalid arguments for tool nakafa_search_content: data/queries must be array",
              },
            ],
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
          id: 30,
        },
      },
      headers: JSON_RESPONSE_HEADERS,
      status: 200,
    },
    name: "nakafa_search_content rejects a queries value that is not a list",
    request: modernPost(
      30,
      "tools/call",
      { arguments: { queries: "algebra" }, name: "nakafa_search_content" },
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
                text: "Input validation error: Invalid arguments for tool nakafa_search_content: data/limit must be <= 10, data/limit must be null, data/limit must match a schema in anyOf",
              },
            ],
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
          id: 31,
        },
      },
      headers: JSON_RESPONSE_HEADERS,
      status: 200,
    },
    name: "nakafa_search_content rejects a limit above its ceiling",
    request: modernPost(
      31,
      "tools/call",
      { arguments: { limit: 11 }, name: "nakafa_search_content" },
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
                text: "Input validation error: Invalid arguments for tool nakafa_get_content: data must have required property 'content_ref'",
              },
            ],
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
          id: 32,
        },
      },
      headers: JSON_RESPONSE_HEADERS,
      status: 200,
    },
    name: "nakafa_get_content rejects a call without content_ref",
    request: modernPost(
      32,
      "tools/call",
      { arguments: {}, name: "nakafa_get_content" },
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
                text: "Input validation error: Invalid arguments for tool nakafa_get_taxonomy: data/locale must be equal to one of the allowed values, data/locale must be null, data/locale must match a schema in anyOf",
              },
            ],
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
          id: 33,
        },
      },
      headers: JSON_RESPONSE_HEADERS,
      status: 200,
    },
    name: "nakafa_get_taxonomy rejects an unsupported locale",
    request: modernPost(
      33,
      "tools/call",
      { arguments: { locale: "fr" }, name: "nakafa_get_taxonomy" },
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
                text: "Input validation error: Invalid arguments for tool nakafa_get_quran_reference: data must have required property 'surah'",
              },
            ],
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
          id: 34,
        },
      },
      headers: JSON_RESPONSE_HEADERS,
      status: 200,
    },
    name: "nakafa_get_quran_reference rejects a call without a surah",
    request: modernPost(
      34,
      "tools/call",
      {
        arguments: { from_verse: 1, locale: "en" },
        name: "nakafa_get_quran_reference",
      },
      "nakafa_get_quran_reference"
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
                text: "Input validation error: Invalid arguments for tool nakafa_get_quran_reference: data/surah must be <= 114",
              },
            ],
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
          id: 35,
        },
      },
      headers: JSON_RESPONSE_HEADERS,
      status: 200,
    },
    name: "nakafa_get_quran_reference rejects a surah outside 1 to 114",
    request: modernPost(
      35,
      "tools/call",
      { arguments: { surah: 115 }, name: "nakafa_get_quran_reference" },
      "nakafa_get_quran_reference"
    ),
  },
  {
    answer: {
      body: {
        json: {
          jsonrpc: "2.0",
          id: 37,
          error: {
            code: -32_602,
            message: "Tool nakafa_unknown_tool not found",
          },
        },
      },
      headers: JSON_RESPONSE_HEADERS,
      status: 200,
    },
    name: "tools/call rejects an unknown tool name",
    request: modernPost(
      37,
      "tools/call",
      { arguments: {}, name: "nakafa_unknown_tool" },
      "nakafa_unknown_tool"
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
                text: "Input validation error: Invalid arguments for tool nakafa_get_content: data/content_ref must be string",
              },
            ],
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
          id: 41,
        },
      },
      headers: JSON_RESPONSE_HEADERS,
      status: 200,
    },
    name: "nakafa_get_content rejects a content_ref that is not a string",
    request: modernPost(
      41,
      "tools/call",
      { arguments: { content_ref: 5 }, name: "nakafa_get_content" },
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
                text: "Input validation error: Invalid arguments for tool nakafa_get_taxonomy: data/locale must be string, data/locale must be equal to one of the allowed values, data/locale must be null, data/locale must match a schema in anyOf",
              },
            ],
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
          id: 42,
        },
      },
      headers: JSON_RESPONSE_HEADERS,
      status: 200,
    },
    name: "nakafa_get_taxonomy rejects a locale that is not a string",
    request: modernPost(
      42,
      "tools/call",
      { arguments: { locale: 5 }, name: "nakafa_get_taxonomy" },
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
                text: "Input validation error: Invalid arguments for tool nakafa_get_quran_reference: data/surah must be integer",
              },
            ],
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
          id: 43,
        },
      },
      headers: JSON_RESPONSE_HEADERS,
      status: 200,
    },
    name: "nakafa_get_quran_reference rejects a surah that is not an integer",
    request: modernPost(
      43,
      "tools/call",
      { arguments: { surah: "1" }, name: "nakafa_get_quran_reference" },
      "nakafa_get_quran_reference"
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
