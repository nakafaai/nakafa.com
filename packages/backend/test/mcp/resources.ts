import { type McpCase, modernPost } from "@repo/backend/test/mcp/harness";
import { JSON_RESPONSE_HEADERS } from "@repo/backend/test/mcp/headers";

/** Resources: the static usage and taxonomy documents, content by URI, and the refusals for unknown URIs. */
export const RESOURCE_CASES: readonly McpCase[] = [
  {
    answer: {
      body: {
        json: {
          result: {
            contents: [
              {
                mimeType: "text/markdown",
                text: "# Nakafa MCP Usage\n\nUse `https://mcp.nakafa.com/mcp` as the Streamable HTTP MCP endpoint.\n\n## Workflow\n\n1. Call `nakafa_get_taxonomy` to inspect supported locales and content sections.\n2. Call `nakafa_search_content` with queries, locale, and optional section.\n3. Pass source-backed `content_id` values as `content_ref` to `nakafa_get_content`.\n4. Cite the returned canonical Nakafa URL in final answers.",
                uri: "nakafa://usage",
              },
            ],
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
          id: 50,
        },
      },
      headers: JSON_RESPONSE_HEADERS,
      status: 200,
    },
    name: "resources/read returns the usage guidance as Markdown",
    request: modernPost(
      50,
      "resources/read",
      { uri: "nakafa://usage" },
      "nakafa://usage"
    ),
  },
  {
    answer: {
      body: {
        json: {
          jsonrpc: "2.0",
          id: 51,
          error: {
            code: -32_603,
            message: "Unable to read signed Nakafa content inventory.",
          },
        },
      },
      headers: JSON_RESPONSE_HEADERS,
      status: 200,
    },
    name: "resources/read reports the taxonomy document as unavailable from an empty deployment",
    request: modernPost(
      51,
      "resources/read",
      { uri: "nakafa://taxonomy" },
      "nakafa://taxonomy"
    ),
  },
  {
    answer: {
      body: {
        json: {
          result: {
            contents: [
              {
                mimeType: "text/markdown",
                text: "# Article 0\n\n## Technical fixture",
                uri: "nakafa://content/asset:en:article:politics:article:politics:article-0",
              },
            ],
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
          id: 52,
        },
      },
      headers: JSON_RESPONSE_HEADERS,
      status: 200,
    },
    arrangement: "article",
    name: "resources/read returns the signed Markdown of a content URI",
    request: modernPost(
      52,
      "resources/read",
      {
        uri: "nakafa://content/asset:en:article:politics:article:politics:article-0",
      },
      "nakafa://content/asset:en:article:politics:article:politics:article-0"
    ),
  },
  {
    answer: {
      body: {
        json: {
          jsonrpc: "2.0",
          id: 18,
          error: {
            code: -32_602,
            message: "Nakafa content resource was not found.",
            data: { uri: "nakafa://content/asset:en:article:missing" },
          },
        },
      },
      headers: JSON_RESPONSE_HEADERS,
      status: 200,
    },
    name: "resources/read refuses a content URI that does not exist",
    request: modernPost(
      18,
      "resources/read",
      { uri: "nakafa://content/asset:en:article:missing" },
      "nakafa://content/asset:en:article:missing"
    ),
  },
  {
    answer: {
      body: {
        json: {
          jsonrpc: "2.0",
          id: 53,
          error: {
            code: -32_602,
            message: "Resource not found: https://nakafa.com/en/articles",
            data: { uri: "https://nakafa.com/en/articles" },
          },
        },
      },
      headers: JSON_RESPONSE_HEADERS,
      status: 200,
    },
    name: "resources/read refuses a URI with an unknown scheme",
    request: modernPost(
      53,
      "resources/read",
      { uri: "https://nakafa.com/en/articles" },
      "https://nakafa.com/en/articles"
    ),
  },
];
