import { type McpCase, modernPost } from "@repo/backend/test/mcp/harness";
import { JSON_RESPONSE_HEADERS } from "@repo/backend/test/mcp/headers";
import { GET_CONTENT_OUTPUT } from "@repo/backend/test/mcp/outputs/content";
import { GET_QURAN_REFERENCE_OUTPUT } from "@repo/backend/test/mcp/outputs/quran";
import { SEARCH_CONTENT_OUTPUT } from "@repo/backend/test/mcp/outputs/search";

/** Tool calls: each tool's success and declared failures, pinned against seeded publications. */
export const TOOL_CALL_CASES: readonly McpCase[] = [
  {
    answer: {
      body: {
        json: {
          result: {
            content: [
              {
                type: "text",
                text: '{"count":1,"has_more":false,"items":[{"alignmentId":"alignment:article:politics:article:politics:article-0","assetId":"asset:en:article:politics:article:politics:article-0","conceptId":"concept:article:politics","content_id":"asset:en:article:politics:article:politics:article-0","learningObjectId":"lo:article:politics:article-0","lensId":"lens:article:politics","locale":"en","route":"articles/politics/article-0","section":"articles","url":"https://nakafa.com/en/articles/politics/article-0","markdown_url":"https://nakafa.com/en/articles/politics/article-0.md","description":"","title":"Article 0","excerpt":"Article 0 Article 0 articles/politics/article-0 rational function grade eleven asymptote"}],"limit":10,"offset":0}',
              },
            ],
            structuredContent: SEARCH_CONTENT_OUTPUT,
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
          id: 24,
        },
      },
      headers: JSON_RESPONSE_HEADERS,
      status: 200,
    },
    arrangement: "article",
    name: "nakafa_search_content returns the seeded article for a query",
    request: modernPost(
      24,
      "tools/call",
      {
        arguments: {
          locale: "en",
          queries: ["rational function"],
          section: "articles",
        },
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
                text: '{"alignmentId":"alignment:article:politics:article:politics:article-0","assetId":"asset:en:article:politics:article:politics:article-0","conceptId":"concept:article:politics","content_id":"asset:en:article:politics:article:politics:article-0","learningObjectId":"lo:article:politics:article-0","lensId":"lens:article:politics","locale":"en","route":"articles/politics/article-0","section":"articles","url":"https://nakafa.com/en/articles/politics/article-0","markdown_url":"https://nakafa.com/en/articles/politics/article-0.md","text":"# Article 0\\n\\n## Technical fixture","title":"Article 0"}',
              },
            ],
            structuredContent: GET_CONTENT_OUTPUT,
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
          id: 25,
        },
      },
      headers: JSON_RESPONSE_HEADERS,
      status: 200,
    },
    arrangement: "article",
    name: "nakafa_get_content returns the signed article Markdown for its canonical URL",
    request: modernPost(
      25,
      "tools/call",
      {
        arguments: {
          content_ref: "https://nakafa.com/en/articles/politics/article-0",
        },
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
                text: '{"alignmentId":"alignment:quran:quran-surah:1","assetId":"asset:en:quran:quran-surah:1","conceptId":"concept:quran:surah:1","content_id":"asset:en:quran:quran-surah:1","learningObjectId":"lo:quran-surah:1","lensId":"lens:quran","locale":"en","route":"quran/1","section":"quran","url":"https://nakafa.com/en/quran/1","markdown_url":"https://nakafa.com/en/quran/1.md","name":"Technical Surah 1","pre_bismillah":null,"revelation":"Meccan","verses":[{"arabic":"آية 1","number":1,"translation":{"notes":[],"segments":[{"kind":"text","offset":0,"value":"Technical translation 1"}]}},{"arabic":"آية 2","number":2,"translation":{"notes":[],"segments":[{"kind":"text","offset":0,"value":"Technical translation 2"}]}}],"meaning":{"locale":"en","text":"Technical meaning 1"},"sources":{"arabic":{"artifact":{"byte_count":1,"digest":"sha256:1111111111111111111111111111111111111111111111111111111111111111","file_count":1},"id":"tanzil-text","kind":"embedded","label":"Technical source tanzil-text en","notice":"Technical attribution notice en","publisher":"Nakafa protocol tests","retrieved_at":"2026-07-31T00:00:00Z","source_url":"https://example.test/tanzil-text","terms":{"artifact":{"byte_count":1,"digest":"sha256:1111111111111111111111111111111111111111111111111111111111111111","file_count":1},"url":"https://example.test/tanzil-text/terms"},"update_url":"https://example.test/tanzil-text/updates","version":"technical-version"},"translation":{"artifact":{"byte_count":1,"digest":"sha256:1111111111111111111111111111111111111111111111111111111111111111","file_count":1},"id":"quranenc-english","kind":"embedded","label":"Technical source quranenc-english en","notice":"Technical attribution notice en","publisher":"Nakafa protocol tests","retrieved_at":"2026-07-31T00:00:00Z","source_url":"https://example.test/quranenc-english","terms":{"artifact":{"byte_count":1,"digest":"sha256:1111111111111111111111111111111111111111111111111111111111111111","file_count":1},"url":"https://example.test/quranenc-english/terms"},"update_url":"https://example.test/quranenc-english/updates","version":"technical-version","locale":"en"}},"tafsir_access":{"kind":"external","locale":"en","notice":"Technical English Tafsir notice.","source":{"id":"mokhtasar-english","kind":"external","label":"Technical source mokhtasar-english en","notice":"Technical attribution notice en","publisher":"Nakafa protocol tests","retrieved_at":"2026-07-31T00:00:00Z","source_url":"https://example.test/mokhtasar-english","terms":{"access":"link-only","url":"https://example.test/mokhtasar-english/terms"},"update_url":"https://example.test/mokhtasar-english/updates","version":"technical-version"}}}',
              },
            ],
            structuredContent: GET_QURAN_REFERENCE_OUTPUT,
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
          id: 27,
        },
      },
      headers: JSON_RESPONSE_HEADERS,
      status: 200,
    },
    arrangement: "quran",
    name: "nakafa_get_quran_reference returns the bounded English verse range",
    request: modernPost(
      27,
      "tools/call",
      {
        arguments: {
          from_verse: 1,
          include_tafsir: false,
          locale: "en",
          surah: 1,
          to_verse: 2,
        },
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
                text: '{"count":0,"has_more":false,"items":[],"limit":10,"offset":0}',
              },
            ],
            structuredContent: {
              count: 0,
              has_more: false,
              items: [],
              limit: 10,
              offset: 0,
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
          id: 20,
        },
      },
      headers: JSON_RESPONSE_HEADERS,
      status: 200,
    },
    name: "nakafa_search_content answers stable empty pagination from an empty deployment",
    request: modernPost(
      20,
      "tools/call",
      {
        arguments: {
          limit: 10,
          locale: "en",
          offset: 0,
          queries: ["algebra"],
        },
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
                text: '{"error":{"message":"Call nakafa_search_content and pass a content_id only from a result with markdown_url.","suggestions":["The supplied content_ref did not resolve."]}}',
              },
            ],
            structuredContent: {
              error: {
                message:
                  "Call nakafa_search_content and pass a content_id only from a result with markdown_url.",
                suggestions: ["The supplied content_ref did not resolve."],
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
          id: 21,
        },
      },
      headers: JSON_RESPONSE_HEADERS,
      status: 200,
    },
    name: "nakafa_get_content reports an unresolved content_ref with search guidance",
    request: modernPost(
      21,
      "tools/call",
      {
        arguments: {
          content_ref: "https://nakafa.com/en/articles/missing/content",
        },
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
                text: '{"error":{"message":"Unable to read signed Nakafa Quran catalog.","suggestions":["Retry later using the same documented arguments."]}}',
              },
            ],
            structuredContent: {
              error: {
                message: "Unable to read signed Nakafa Quran catalog.",
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
          id: 23,
        },
      },
      headers: JSON_RESPONSE_HEADERS,
      status: 200,
    },
    name: "nakafa_get_quran_reference reports the unavailable catalog from an empty deployment",
    request: modernPost(
      23,
      "tools/call",
      {
        arguments: { from_verse: 1, locale: "en", surah: 1 },
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
                text: '{"error":{"message":"Invalid Quran verse range.","suggestions":["Surah 1 ends at verse 7."]}}',
              },
            ],
            structuredContent: {
              error: {
                message: "Invalid Quran verse range.",
                suggestions: ["Surah 1 ends at verse 7."],
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
          id: 28,
        },
      },
      headers: JSON_RESPONSE_HEADERS,
      status: 200,
    },
    arrangement: "quran",
    name: "nakafa_get_quran_reference rejects a verse range past the end of the surah",
    request: modernPost(
      28,
      "tools/call",
      {
        arguments: { from_verse: 6, locale: "en", surah: 1, to_verse: 8 },
        name: "nakafa_get_quran_reference",
      },
      "nakafa_get_quran_reference"
    ),
  },
];
