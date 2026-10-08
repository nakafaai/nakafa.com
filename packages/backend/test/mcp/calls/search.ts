import { type McpCase, modernPost } from "@repo/backend/test/mcp/harness";
import { JSON_RESPONSE_HEADERS } from "@repo/backend/test/mcp/headers";
import { SEARCH_CONTENT_OUTPUT } from "@repo/backend/test/mcp/outputs/search";

/** Search calls: the seeded article for a query, and stable pagination from an empty deployment. */
export const SEARCH_CALL_CASES: readonly McpCase[] = [
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
];
