import type { McpServer } from "@modelcontextprotocol/server";
import { QURAN_SURAH_COUNT } from "@nakafa/aksara-contracts/quran/spec";
import { getNakafaContent } from "@repo/backend/agent/content";
import { decodeAgentInput } from "@repo/backend/agent/decode";
import {
  mcpToolOutputSchema,
  runMcpTool,
} from "@repo/backend/agent/mcp/result";
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
import { Effect, Option } from "effect";

const READ_ONLY_TOOL = {
  destructiveHint: false,
  idempotentHint: true,
  openWorldHint: false,
  readOnlyHint: true,
};

/** Registers the four public read-only tools over shared Convex programs. */
export function registerNakafaMcpTools(
  server: McpServer,
  ctx: ActionCtx,
  requestId: string
) {
  server.registerTool(
    "nakafa_search_content",
    {
      annotations: READ_ONLY_TOOL,
      description:
        "Search Nakafa's signed public educational content with stable pagination.",
      inputSchema: toMcpSchema(NakafaAgentSearchOptionsSchema),
      outputSchema: toMcpSchema(
        mcpToolOutputSchema(NakafaAgentSearchResultSchema)
      ),
      title: "Search Nakafa content",
    },
    (input) => runMcpTool(searchNakafaContent(ctx, input), requestId)
  );

  server.registerTool(
    "nakafa_get_content",
    {
      annotations: READ_ONLY_TOOL,
      description:
        "Read full agent-ready Markdown for a readable Nakafa content ID or canonical URL. Search results without markdown_url are citation-only catalog entries.",
      inputSchema: toMcpSchema(NakafaAgentReadOptionsSchema),
      outputSchema: toMcpSchema(mcpToolOutputSchema(NakafaAgentMarkdownSchema)),
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
        ),
        requestId
      )
  );

  server.registerTool(
    "nakafa_get_taxonomy",
    {
      annotations: READ_ONLY_TOOL,
      description:
        "List supported Nakafa sections, locales, categories, counts, and tools.",
      inputSchema: toMcpSchema(NakafaAgentTaxonomyOptionsSchema),
      outputSchema: toMcpSchema(mcpToolOutputSchema(NakafaAgentTaxonomySchema)),
      title: "Read Nakafa taxonomy",
    },
    (input) =>
      runMcpTool(
        decodeAgentInput(
          NakafaAgentTaxonomyOptionsSchema,
          input,
          "Invalid Nakafa taxonomy options."
        ).pipe(Effect.flatMap(({ locale }) => getNakafaTaxonomy(ctx, locale))),
        requestId
      )
  );

  server.registerTool(
    "nakafa_get_quran_reference",
    {
      annotations: READ_ONLY_TOOL,
      description:
        "Read a bounded Quran verse range with reviewed translation and optional tafsir.",
      inputSchema: toMcpSchema(NakafaAgentQuranReferenceOptionsSchema),
      outputSchema: toMcpSchema(
        mcpToolOutputSchema(NakafaAgentQuranReferenceSchema)
      ),
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
                  message: `Pass a surah number from 1 through ${QURAN_SURAH_COUNT}.`,
                }),
              onSome: Effect.succeed,
            })
          )
        ),
        requestId
      )
  );
}
