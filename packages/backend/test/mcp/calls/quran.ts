import { type McpCase, modernPost } from "@repo/backend/test/mcp/harness";
import { JSON_RESPONSE_HEADERS } from "@repo/backend/test/mcp/headers";
import { GET_QURAN_REFERENCE_OUTPUT } from "@repo/backend/test/mcp/outputs/quran";

/** Quran calls: a bounded verse range from the seeded catalog, and the refusals for empty catalogs, invalid ranges, and locales the catalog does not publish. */
export const QURAN_CALL_CASES: readonly McpCase[] = [
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
  {
    answer: {
      body: {
        json: {
          result: {
            content: [
              {
                type: "text",
                text: '{"error":{"message":"Invalid Quran verse range.","suggestions":["to_verse must be greater than or equal to from_verse."]}}',
              },
            ],
            structuredContent: {
              error: {
                message: "Invalid Quran verse range.",
                suggestions: [
                  "to_verse must be greater than or equal to from_verse.",
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
          id: 47,
        },
      },
      headers: JSON_RESPONSE_HEADERS,
      status: 200,
    },
    arrangement: "quran",
    name: "nakafa_get_quran_reference rejects a range that ends before it starts",
    request: modernPost(
      47,
      "tools/call",
      {
        arguments: { from_verse: 5, locale: "en", surah: 1, to_verse: 2 },
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
                text: '{"error":{"message":"Invalid Quran verse range.","suggestions":["Request at most 20 verses at a time."]}}',
              },
            ],
            structuredContent: {
              error: {
                message: "Invalid Quran verse range.",
                suggestions: ["Request at most 20 verses at a time."],
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
          id: 48,
        },
      },
      headers: JSON_RESPONSE_HEADERS,
      status: 200,
    },
    arrangement: "quran",
    name: "nakafa_get_quran_reference rejects a range above the verse ceiling",
    request: modernPost(
      48,
      "tools/call",
      {
        arguments: { from_verse: 1, locale: "en", surah: 1, to_verse: 100 },
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
                text: '{"error":{"message":"Unable to read the signed Nakafa Quran reference.","suggestions":["Retry later using the same documented arguments."]}}',
              },
            ],
            structuredContent: {
              error: {
                message: "Unable to read the signed Nakafa Quran reference.",
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
          id: 49,
        },
      },
      headers: JSON_RESPONSE_HEADERS,
      status: 200,
    },
    arrangement: "quran",
    name: "nakafa_get_quran_reference reports a locale the signed catalog does not publish",
    request: modernPost(
      49,
      "tools/call",
      {
        arguments: { from_verse: 1, locale: "id", surah: 1 },
        name: "nakafa_get_quran_reference",
      },
      "nakafa_get_quran_reference"
    ),
  },
];
