import { NAKAFA_GET_CONTENT_TOOL } from "@repo/backend/test/mcp/descriptors/content";
import { NAKAFA_GET_QURAN_REFERENCE_TOOL } from "@repo/backend/test/mcp/descriptors/quran";
import { NAKAFA_SEARCH_CONTENT_TOOL } from "@repo/backend/test/mcp/descriptors/search";
import { NAKAFA_GET_TAXONOMY_TOOL } from "@repo/backend/test/mcp/descriptors/taxonomy";
import { type McpCase, modernPost } from "@repo/backend/test/mcp/harness";
import { JSON_RESPONSE_HEADERS } from "@repo/backend/test/mcp/headers";

/** Discovery and list answers: the server identity, and every tool, prompt, resource, and template. */
export const DISCOVERY_CASES: readonly McpCase[] = [
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
          id: 1,
        },
      },
      headers: JSON_RESPONSE_HEADERS,
      status: 200,
    },
    name: "server/discover answers the server identity and capabilities",
    request: modernPost(1, "server/discover"),
  },
  {
    answer: {
      body: {
        json: {
          result: {
            tools: [
              NAKAFA_SEARCH_CONTENT_TOOL,
              NAKAFA_GET_CONTENT_TOOL,
              NAKAFA_GET_TAXONOMY_TOOL,
              NAKAFA_GET_QURAN_REFERENCE_TOOL,
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
          id: 2,
        },
      },
      headers: JSON_RESPONSE_HEADERS,
      status: 200,
    },
    name: "tools/list answers every tool with its schemas and annotations",
    request: modernPost(2, "tools/list"),
  },
  {
    answer: {
      body: {
        json: {
          result: {
            prompts: [
              {
                name: "nakafa_find_lesson",
                title: "Find Nakafa Lesson",
                description:
                  "Guide an agent to search Nakafa lessons and choose relevant public content.",
                arguments: [
                  { name: "locale", required: false },
                  { name: "topic", required: true },
                ],
              },
              {
                name: "nakafa_answer_from_content",
                title: "Answer From Nakafa Content",
                description:
                  "Guide an agent to answer a question from one retrieved Nakafa content item.",
                arguments: [
                  { name: "content_ref", required: true },
                  { name: "question", required: true },
                ],
              },
              {
                name: "nakafa_quran_reference",
                title: "Nakafa Quran Reference",
                description:
                  "Guide an agent to retrieve Quran verses with translation and citation.",
                arguments: [
                  { name: "from_verse", required: false },
                  { name: "locale", required: false },
                  { name: "question", required: false },
                  { name: "surah", required: true },
                  { name: "to_verse", required: false },
                ],
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
          id: 3,
        },
      },
      headers: JSON_RESPONSE_HEADERS,
      status: 200,
    },
    name: "prompts/list answers every prompt with its argument schema",
    request: modernPost(3, "prompts/list"),
  },
  {
    answer: {
      body: {
        json: {
          result: {
            resources: [
              {
                uri: "nakafa://usage",
                name: "nakafa_usage",
                description:
                  "Recommended workflow for using the Nakafa MCP server.",
                mimeType: "text/markdown",
                title: "Nakafa MCP Usage",
              },
              {
                uri: "nakafa://taxonomy",
                name: "nakafa_taxonomy",
                description:
                  "Supported Nakafa locales, sections, and categories.",
                mimeType: "application/json",
                title: "Nakafa Taxonomy",
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
          id: 4,
        },
      },
      headers: JSON_RESPONSE_HEADERS,
      status: 200,
    },
    name: "resources/list answers the static resources",
    request: modernPost(4, "resources/list"),
  },
  {
    answer: {
      body: {
        json: {
          result: {
            resourceTemplates: [
              {
                name: "nakafa_content",
                uriTemplate: "nakafa://content/{contentId}",
                description: "Full Markdown for a readable Nakafa content ID.",
                mimeType: "text/markdown",
                title: "Nakafa Content",
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
          id: 5,
        },
      },
      headers: JSON_RESPONSE_HEADERS,
      status: 200,
    },
    name: "resources/templates/list answers the content template",
    request: modernPost(5, "resources/templates/list"),
  },
];
