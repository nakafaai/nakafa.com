import {
  type McpServer,
  ResourceNotFoundError,
  ResourceTemplate,
} from "@modelcontextprotocol/server";
import { getNakafaContent } from "@repo/backend/agent/content";
import { getNakafaTaxonomy } from "@repo/backend/agent/taxonomy";
import type { QueryRunner } from "@repo/backend/confect/_generated/services";
import { getNakafaMcpUsageMarkdown } from "@repo/contents/agent/usage";
import { Effect, Option } from "effect";

/** Registers the established static and templated Nakafa resources. */
export const registerNakafaMcpResources = Effect.fn(
  "agent.mcp.registerNakafaMcpResources"
)(function* (server: McpServer) {
  const runtimeServices = yield* Effect.context<QueryRunner>();
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
      description: "Supported Nakafa locales, sections, and categories.",
      mimeType: "application/json",
      title: "Nakafa Taxonomy",
    },
    (uri) =>
      Effect.runPromiseWith(runtimeServices)(
        getNakafaTaxonomy().pipe(
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
    new ResourceTemplate("nakafa://content/{contentId}", {
      list: undefined,
    }),
    {
      description: "Full Markdown for a readable Nakafa content ID.",
      mimeType: "text/markdown",
      title: "Nakafa Content",
    },
    (uri) =>
      Effect.runPromiseWith(runtimeServices)(
        getNakafaContent(uri.toString()).pipe(
          Effect.flatMap(
            Option.match({
              onNone: () =>
                Effect.fail(
                  new ResourceNotFoundError(
                    uri.toString(),
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
});
