import { type McpCase, modernPost } from "@repo/backend/test/mcp/harness";
import { JSON_RESPONSE_HEADERS } from "@repo/backend/test/mcp/headers";
import { GET_CONTENT_OUTPUT } from "@repo/backend/test/mcp/outputs/content";

/** Content calls: one signed article by its canonical URL, and references that do not resolve or cannot be read. */
export const CONTENT_CALL_CASES: readonly McpCase[] = [
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
                text: '{"error":{"message":"Unable to resolve the Nakafa content reference.","suggestions":["Retry later using the same documented arguments."]}}',
              },
            ],
            structuredContent: {
              error: {
                message: "Unable to resolve the Nakafa content reference.",
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
          id: 45,
        },
      },
      headers: JSON_RESPONSE_HEADERS,
      status: 200,
    },
    arrangement: "quran",
    name: "nakafa_get_content cannot resolve an article reference from a Quran-only deployment",
    request: modernPost(
      45,
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
];
