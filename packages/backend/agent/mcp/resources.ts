import { getNakafaContent } from "@repo/backend/agent/content";
import { getNakafaTaxonomy } from "@repo/backend/agent/taxonomy";
import type { QueryRunner } from "@repo/backend/confect/_generated/services";
import { getNakafaMcpUsageMarkdown } from "@repo/contents/agent/usage";
import { encodePrettyJsonText } from "@repo/utilities/json";
import { Context, Effect, Option } from "effect";
import { McpSchema, McpServer } from "effect/ai";

const USAGE_URI = "nakafa://usage";
const TAXONOMY_URI = "nakafa://taxonomy";
/**
 * The content template's route. FindMyWay escapes the scheme's colon as "::" and
 * names the single parameter `:0`, the same route Effect compiles for
 * `nakafa://content/{contentId}`.
 */
const CONTENT_ROUTER_PATH = "nakafa:://content/:0";
const UNEXPECTED_FAILURE_MESSAGE =
  "Nakafa MCP could not complete this request.";

/** Registers the established static and templated Nakafa resources. */
export const registerNakafaMcpResources = Effect.fn(
  "agent.mcp.registerNakafaMcpResources"
)(function* (services: Context.Context<QueryRunner>) {
  const server = yield* McpServer.McpServer;
  yield* server.addResource({
    annotations: Context.empty(),
    handle: Effect.succeed({
      contents: [
        {
          mimeType: "text/markdown",
          text: getNakafaMcpUsageMarkdown(),
          uri: USAGE_URI,
        },
      ],
    }),
    resource: McpSchema.Resource.make({
      description: "Recommended workflow for using the Nakafa MCP server.",
      mimeType: "text/markdown",
      name: "nakafa_usage",
      title: "Nakafa MCP Usage",
      uri: USAGE_URI,
    }),
  });
  yield* server.addResource({
    annotations: Context.empty(),
    handle: getNakafaTaxonomy().pipe(
      Effect.mapError(toInternalError),
      Effect.map((taxonomy) => ({
        contents: [
          {
            mimeType: "application/json",
            text: encodePrettyJsonText(taxonomy),
            uri: TAXONOMY_URI,
          },
        ],
      })),
      Effect.provideContext(services),
      Effect.catchDefect(unexpectedResourceFailure)
    ),
    resource: McpSchema.Resource.make({
      description: "Supported Nakafa locales, sections, and categories.",
      mimeType: "application/json",
      name: "nakafa_taxonomy",
      title: "Nakafa Taxonomy",
      uri: TAXONOMY_URI,
    }),
  });
  yield* server.addResourceTemplate({
    annotations: Context.empty(),
    completions: {},
    handle: (uri) =>
      getNakafaContent(uri).pipe(
        Effect.mapError(toInternalError),
        Effect.flatMap(
          Option.match({
            onNone: () =>
              Effect.fail(
                McpSchema.InvalidParams.make({
                  data: { uri },
                  message: "Nakafa content resource was not found.",
                })
              ),
            onSome: (content) =>
              Effect.succeed({
                contents: [
                  {
                    mimeType: "text/markdown",
                    text: content.text,
                    uri,
                  },
                ],
              }),
          })
        ),
        Effect.provideContext(services),
        Effect.catchDefect(unexpectedResourceFailure)
      ),
    routerPath: CONTENT_ROUTER_PATH,
    template: McpSchema.ResourceTemplate.make({
      description: "Full Markdown for a readable Nakafa content ID.",
      mimeType: "text/markdown",
      name: "nakafa_content",
      title: "Nakafa Content",
      uriTemplate: "nakafa://content/{contentId}",
    }),
  });
});

/** Keeps a data failure's public message and nothing else of its cause. */
function toInternalError(error: { readonly message: string }) {
  return McpSchema.InternalError.make({ message: error.message });
}

/** Logs a defect and answers the client with the generic failure, never the defect. */
const unexpectedResourceFailure = (defect: unknown) =>
  Effect.logError("Unexpected Nakafa MCP resource failure.", defect).pipe(
    Effect.andThen(
      Effect.fail(
        McpSchema.InternalError.make({ message: UNEXPECTED_FAILURE_MESSAGE })
      )
    )
  );
