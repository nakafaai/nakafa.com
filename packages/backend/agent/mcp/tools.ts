import { getNakafaContent } from "@repo/backend/agent/content";
import { decodeAgentInput } from "@repo/backend/agent/decode";
import {
  mcpToolOutputSchema,
  runMcpTool,
} from "@repo/backend/agent/mcp/result";
import {
  type McpObjectContract,
  toMcpInputSchema,
  toMcpOutputSchema,
} from "@repo/backend/agent/mcp/schema";
import { getNakafaQuranReference } from "@repo/backend/agent/quran";
import { searchNakafaContent } from "@repo/backend/agent/search";
import { getNakafaTaxonomy } from "@repo/backend/agent/taxonomy";
import type { QueryRunner } from "@repo/backend/confect/_generated/services";
import { NakafaAgentInputError } from "@repo/contents/agent/errors";
import { NakafaAgentQuranReferenceOptionsSchema } from "@repo/contents/agent/schema/quran/input";
import { NakafaAgentQuranReferenceSchema } from "@repo/contents/agent/schema/quran/reference";
import {
  NakafaAgentMarkdownSchema,
  NakafaAgentReadOptionsSchema,
} from "@repo/contents/agent/schema/read";
import {
  NakafaAgentSearchOptionsSchema,
  NakafaAgentSearchResultSchema,
} from "@repo/contents/agent/schema/search";
import {
  NakafaAgentTaxonomyOptionsSchema,
  NakafaAgentTaxonomySchema,
} from "@repo/contents/agent/schema/taxonomy";
import { Context, Effect, Option } from "effect";
import { McpSchema, McpServer } from "effect/ai";

const READ_ONLY_ANNOTATIONS = {
  destructiveHint: false,
  idempotentHint: true,
  openWorldHint: false,
  readOnlyHint: true,
};

/** Builds one read-only tool definition from its public text and Effect contracts. */
const readOnlyTool = Effect.fn("agent.mcp.readOnlyTool")(function* (options: {
  readonly name: string;
  readonly title: string;
  readonly description: string;
  readonly input: McpObjectContract;
  readonly output: McpObjectContract;
}) {
  const inputSchema = yield* toMcpInputSchema(options.input);
  const outputSchema = yield* toMcpOutputSchema(options.output);
  return new McpSchema.Tool({
    annotations: READ_ONLY_ANNOTATIONS,
    description: options.description,
    inputSchema,
    name: options.name,
    outputSchema,
    title: options.title,
  });
}, Effect.orDie);

/** Registers the public read-only tools over shared Convex programs. */
export const registerNakafaMcpTools = Effect.fn(
  "agent.mcp.registerNakafaMcpTools"
)(function* (services: Context.Context<QueryRunner>, requestId: string) {
  const server = yield* McpServer.McpServer;
  yield* server.addTool({
    annotations: Context.empty(),
    handle: (input: unknown) =>
      runMcpTool(
        searchNakafaContent(input).pipe(Effect.provideContext(services)),
        requestId
      ),
    tool: yield* readOnlyTool({
      description:
        "Search Nakafa's signed public educational content with stable pagination.",
      input: NakafaAgentSearchOptionsSchema,
      name: "nakafa_search_content",
      output: mcpToolOutputSchema(NakafaAgentSearchResultSchema),
      title: "Search Nakafa content",
    }),
  });
  yield* server.addTool({
    annotations: Context.empty(),
    handle: (input: unknown) =>
      runMcpTool(
        decodeAgentInput(
          NakafaAgentReadOptionsSchema,
          input,
          "Invalid Nakafa content read options."
        ).pipe(
          Effect.flatMap(({ content_ref: contentRef }) =>
            getNakafaContent(contentRef)
          ),
          Effect.flatMap(
            Option.match({
              onNone: () =>
                new NakafaAgentInputError({
                  cause: "The supplied content_ref did not resolve.",
                  message:
                    "Call nakafa_search_content and pass a content_id only from a result with markdown_url.",
                }),
              onSome: Effect.succeed,
            })
          ),
          Effect.provideContext(services)
        ),
        requestId
      ),
    tool: yield* readOnlyTool({
      description:
        "Read full agent-ready Markdown for a readable Nakafa content ID or canonical URL. Search results without markdown_url are citation-only catalog entries.",
      input: NakafaAgentReadOptionsSchema,
      name: "nakafa_get_content",
      output: mcpToolOutputSchema(NakafaAgentMarkdownSchema),
      title: "Read Nakafa content",
    }),
  });
  yield* server.addTool({
    annotations: Context.empty(),
    handle: (input: unknown) =>
      runMcpTool(
        decodeAgentInput(
          NakafaAgentTaxonomyOptionsSchema,
          input,
          "Invalid Nakafa taxonomy options."
        ).pipe(
          Effect.flatMap(({ locale }) => getNakafaTaxonomy(locale)),
          Effect.provideContext(services)
        ),
        requestId
      ),
    tool: yield* readOnlyTool({
      description:
        "List supported Nakafa sections, locales, categories, counts, and tools.",
      input: NakafaAgentTaxonomyOptionsSchema,
      name: "nakafa_get_taxonomy",
      output: mcpToolOutputSchema(NakafaAgentTaxonomySchema),
      title: "Read Nakafa taxonomy",
    }),
  });
  yield* server.addTool({
    annotations: Context.empty(),
    handle: (input: unknown) =>
      runMcpTool(
        getNakafaQuranReference(input).pipe(Effect.provideContext(services)),
        requestId
      ),
    tool: yield* readOnlyTool({
      description:
        "Read a bounded Quran verse range with reviewed translation and optional tafsir.",
      input: NakafaAgentQuranReferenceOptionsSchema,
      name: "nakafa_get_quran_reference",
      output: mcpToolOutputSchema(NakafaAgentQuranReferenceSchema),
      title: "Read a Quran reference",
    }),
  });
});
