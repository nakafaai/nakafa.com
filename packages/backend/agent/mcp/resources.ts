import {
  type McpServer,
  ResourceNotFoundError,
  ResourceTemplate,
} from "@modelcontextprotocol/server";
import { getNakafaContent } from "@repo/backend/agent/content";
import { getNakafaTaxonomy } from "@repo/backend/agent/taxonomy";
import type { ActionCtx } from "@repo/backend/convex/_generated/server";
import { getNakafaMcpUsageMarkdown } from "@repo/contents/_lib/agent/usage";
import { Effect, Option } from "effect";

/** Registers the established Nakafa static and templated MCP resources. */
export function registerNakafaMcpResources(server: McpServer, ctx: ActionCtx) {
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
      Effect.runPromise(
        getNakafaTaxonomy(ctx).pipe(
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
      description: "Full Markdown for a readable Nakafa content ID.",
      mimeType: "text/markdown",
      title: "Nakafa Content",
    },
    (uri) =>
      Effect.runPromise(
        getNakafaContent(ctx, uri.toString()).pipe(
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
}
