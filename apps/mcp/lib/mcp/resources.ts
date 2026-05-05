import {
  type McpServer,
  ResourceTemplate,
} from "@modelcontextprotocol/sdk/server/mcp.js";
import { ErrorCode, McpError } from "@modelcontextprotocol/sdk/types.js";
import { getNakafaAgentMarkdown } from "@repo/contents/_lib/agent/markdown";
import { getNakafaAgentTaxonomy } from "@repo/contents/_lib/agent/taxonomy";
import { getNakafaMcpUsageMarkdown } from "@repo/contents/_lib/agent/usage";
import { Effect, Option } from "effect";

/** Registers static and templated Nakafa MCP resources. */
export function registerNakafaMcpResources(server: McpServer) {
  server.registerResource(
    "nakafa_usage",
    "nakafa://usage",
    {
      description: "Recommended workflow for using the Nakafa MCP server.",
      mimeType: "text/markdown",
      title: "Nakafa MCP Usage",
    },
    (uri) => ({
      contents: [
        {
          mimeType: "text/markdown",
          text: getNakafaMcpUsageMarkdown(),
          uri: uri.toString(),
        },
      ],
    })
  );

  server.registerResource(
    "nakafa_taxonomy",
    "nakafa://taxonomy",
    {
      description: "Supported Nakafa locales, sections, categories, and tools.",
      mimeType: "application/json",
      title: "Nakafa Taxonomy",
    },
    (uri) =>
      Effect.runPromise(
        getNakafaAgentTaxonomy().pipe(
          Effect.map((taxonomy) => ({
            contents: [
              {
                mimeType: "application/json",
                text: JSON.stringify(taxonomy, null, 2),
                uri: uri.toString(),
              },
            ],
          }))
        )
      )
  );

  server.registerResource(
    "nakafa_content",
    new ResourceTemplate("nakafa://content/{contentId}", { list: undefined }),
    {
      description: "Full markdown for a Nakafa content ID.",
      mimeType: "text/markdown",
      title: "Nakafa Content",
    },
    (uri) =>
      Effect.runPromise(
        getNakafaAgentMarkdown(uri.toString()).pipe(
          Effect.flatMap(
            Option.match({
              onNone: () =>
                Effect.fail(
                  new McpError(
                    ErrorCode.InvalidParams,
                    "Nakafa content resource was not found."
                  )
                ),
              onSome: (content) =>
                Effect.succeed({
                  contents: [
                    {
                      mimeType: "text/markdown",
                      text: content.text,
                      uri: uri.toString(),
                    },
                  ],
                }),
            })
          )
        )
      )
  );
}
