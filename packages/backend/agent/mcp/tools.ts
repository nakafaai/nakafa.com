import type { McpServer } from "@modelcontextprotocol/server";
import { getNakafaContent } from "@repo/backend/agent/content";
import { decodeAgentInput } from "@repo/backend/agent/decode";
import { runMcpTool } from "@repo/backend/agent/mcp/result";
import { toMcpSchema } from "@repo/backend/agent/mcp/schema";
import { getNakafaQuranReference } from "@repo/backend/agent/quran";
import { searchNakafaContent } from "@repo/backend/agent/search";
import { getNakafaTaxonomy } from "@repo/backend/agent/taxonomy";
import type { ActionCtx } from "@repo/backend/convex/_generated/server";
import { NakafaAgentInputError } from "@repo/contents/_lib/agent/errors";
import {
  NakafaAgentQuranReferenceOptionsSchema,
  NakafaAgentQuranReferenceSchema,
} from "@repo/contents/_lib/agent/schema/quran";
import {
  NakafaAgentMarkdownSchema,
  NakafaAgentReadOptionsSchema,
} from "@repo/contents/_lib/agent/schema/read";
import {
  NakafaAgentSearchOptionsSchema,
  NakafaAgentSearchResultSchema,
} from "@repo/contents/_lib/agent/schema/search";
import {
  NakafaAgentTaxonomyOptionsSchema,
  NakafaAgentTaxonomySchema,
} from "@repo/contents/_lib/agent/schema/taxonomy";
import { Effect, Option, type Schema } from "effect";

const READ_ONLY_TOOL = {
  destructiveHint: false,
  idempotentHint: true,
  openWorldHint: false,
  readOnlyHint: true,
};

/** Registers the four public read-only tools over shared Convex programs. */
export function registerNakafaMcpTools(server: McpServer, ctx: ActionCtx) {
  registerSearchTool(server, ctx);
  registerContentTool(server, ctx);
  registerTaxonomyTool(server, ctx);
  registerQuranTool(server, ctx);
}

/** Registers signed publication search. */
function registerSearchTool(server: McpServer, ctx: ActionCtx) {
  server.registerTool(
    "nakafa_search_content",
    {
      annotations: READ_ONLY_TOOL,
      description:
        "Search Nakafa's signed public educational content with stable pagination.",
      inputSchema: toMcpSchema<unknown>(NakafaAgentSearchOptionsSchema),
      outputSchema: toMcpSchema<
        Schema.Schema.Type<typeof NakafaAgentSearchResultSchema>
      >(NakafaAgentSearchResultSchema),
      title: "Search Nakafa content",
    },
    (input) => runMcpTool(searchNakafaContent(ctx, input))
  );
}

/** Registers exact content retrieval. */
function registerContentTool(server: McpServer, ctx: ActionCtx) {
  server.registerTool(
    "nakafa_get_content",
    {
      annotations: READ_ONLY_TOOL,
      description:
        "Read full agent-ready Markdown for a readable Nakafa content ID or canonical URL. Search results without markdown_url are citation-only catalog entries.",
      inputSchema: toMcpSchema<unknown>(NakafaAgentReadOptionsSchema),
      outputSchema: toMcpSchema<
        Schema.Schema.Type<typeof NakafaAgentMarkdownSchema>
      >(NakafaAgentMarkdownSchema),
      title: "Read Nakafa content",
    },
    (input) =>
      runMcpTool(
        decodeAgentInput(
          NakafaAgentReadOptionsSchema,
          input,
          "Invalid Nakafa content read options."
        ).pipe(
          Effect.flatMap(({ content_ref: contentRef }) =>
            getNakafaContent(ctx, contentRef)
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
          )
        )
      )
  );
}

/** Registers public taxonomy discovery. */
function registerTaxonomyTool(server: McpServer, ctx: ActionCtx) {
  server.registerTool(
    "nakafa_get_taxonomy",
    {
      annotations: READ_ONLY_TOOL,
      description:
        "List supported Nakafa sections, locales, categories, counts, and tools.",
      inputSchema: toMcpSchema<unknown>(NakafaAgentTaxonomyOptionsSchema),
      outputSchema: toMcpSchema<
        Schema.Schema.Type<typeof NakafaAgentTaxonomySchema>
      >(NakafaAgentTaxonomySchema),
      title: "Read Nakafa taxonomy",
    },
    (input) =>
      runMcpTool(
        decodeAgentInput(
          NakafaAgentTaxonomyOptionsSchema,
          input,
          "Invalid Nakafa taxonomy options."
        ).pipe(Effect.flatMap(({ locale }) => getNakafaTaxonomy(ctx, locale)))
      )
  );
}

/** Registers bounded reviewed Quran references. */
function registerQuranTool(server: McpServer, ctx: ActionCtx) {
  server.registerTool(
    "nakafa_get_quran_reference",
    {
      annotations: READ_ONLY_TOOL,
      description:
        "Read a bounded Quran verse range with reviewed translation and optional tafsir.",
      inputSchema: toMcpSchema<unknown>(NakafaAgentQuranReferenceOptionsSchema),
      outputSchema: toMcpSchema<
        Schema.Schema.Type<typeof NakafaAgentQuranReferenceSchema>
      >(NakafaAgentQuranReferenceSchema),
      title: "Read a Quran reference",
    },
    (input) =>
      runMcpTool(
        getNakafaQuranReference(ctx, input).pipe(
          Effect.flatMap(
            Option.match({
              onNone: () =>
                new NakafaAgentInputError({
                  cause: "The requested surah does not exist.",
                  message: "Pass a surah number from 1 through 114.",
                }),
              onSome: Effect.succeed,
            })
          )
        )
      )
  );
}
