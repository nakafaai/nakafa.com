import { type McpCase, modernPost } from "@repo/backend/test/mcp/harness";
import { JSON_RESPONSE_HEADERS } from "@repo/backend/test/mcp/headers";

/** Tool calls refused before any Nakafa read, and a call to a tool that does not exist. */
export const INVALID_TOOL_CALL_CASES: readonly McpCase[] = [
  {
    answer: {
      body: {
        json: {
          result: {
            content: [
              {
                type: "text",
                text: '{"error":{"message":"Invalid Nakafa content search options.","suggestions":["Expected array\\n  at [\\"queries\\"]"]}}',
              },
            ],
            isError: true,
            structuredContent: {
              error: {
                message: "Invalid Nakafa content search options.",
                suggestions: ['Expected array\n  at ["queries"]'],
              },
            },
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
                text: '{"error":{"message":"Invalid Nakafa content search options.","suggestions":["Expected a number between 1 and 10\\n  at [\\"limit\\"]"]}}',
              },
            ],
            isError: true,
            structuredContent: {
              error: {
                message: "Invalid Nakafa content search options.",
                suggestions: [
                  'Expected a number between 1 and 10\n  at ["limit"]',
                ],
              },
            },
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
                text: '{"error":{"message":"Invalid Nakafa content read options.","suggestions":["Missing key\\n  at [\\"content_ref\\"]"]}}',
              },
            ],
            isError: true,
            structuredContent: {
              error: {
                message: "Invalid Nakafa content read options.",
                suggestions: ['Missing key\n  at ["content_ref"]'],
              },
            },
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
                text: '{"error":{"message":"Invalid Nakafa taxonomy options.","suggestions":["Expected \\"en\\" | \\"id\\" | \\"de\\"\\n  at [\\"locale\\"]"]}}',
              },
            ],
            isError: true,
            structuredContent: {
              error: {
                message: "Invalid Nakafa taxonomy options.",
                suggestions: ['Expected "en" | "id" | "de"\n  at ["locale"]'],
              },
            },
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
                text: '{"error":{"message":"Invalid Nakafa Quran reference options.","suggestions":["Missing key\\n  at [\\"surah\\"]"]}}',
              },
            ],
            isError: true,
            structuredContent: {
              error: {
                message: "Invalid Nakafa Quran reference options.",
                suggestions: ['Missing key\n  at ["surah"]'],
              },
            },
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
                text: '{"error":{"message":"Invalid Nakafa Quran reference options.","suggestions":["Surah number must be between 1 and 114.\\n  at [\\"surah\\"]"]}}',
              },
            ],
            isError: true,
            structuredContent: {
              error: {
                message: "Invalid Nakafa Quran reference options.",
                suggestions: [
                  'Surah number must be between 1 and 114.\n  at ["surah"]',
                ],
              },
            },
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
          result: {
            content: [
              {
                type: "text",
                text: '{"error":{"message":"Invalid Nakafa content read options.","suggestions":["Expected string\\n  at [\\"content_ref\\"]"]}}',
              },
            ],
            isError: true,
            structuredContent: {
              error: {
                message: "Invalid Nakafa content read options.",
                suggestions: ['Expected string\n  at ["content_ref"]'],
              },
            },
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
                text: '{"error":{"message":"Invalid Nakafa taxonomy options.","suggestions":["Expected \\"en\\" | \\"id\\" | \\"de\\" | undefined\\n  at [\\"locale\\"]"]}}',
              },
            ],
            isError: true,
            structuredContent: {
              error: {
                message: "Invalid Nakafa taxonomy options.",
                suggestions: [
                  'Expected "en" | "id" | "de" | undefined\n  at ["locale"]',
                ],
              },
            },
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
                text: '{"error":{"message":"Invalid Nakafa Quran reference options.","suggestions":["Expected number\\n  at [\\"surah\\"]"]}}',
              },
            ],
            isError: true,
            structuredContent: {
              error: {
                message: "Invalid Nakafa Quran reference options.",
                suggestions: ['Expected number\n  at ["surah"]'],
              },
            },
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
          jsonrpc: "2.0",
          id: 37,
          error: {
            code: -32_602,
            message: "Tool 'nakafa_unknown_tool' not found",
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
];
