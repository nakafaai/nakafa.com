import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { NAKAFA_AGENT_MAX_QURAN_REFERENCE_VERSES } from "@repo/contents/_lib/agent/constants";
import { getNakafaAgentQuranReference } from "@repo/contents/_lib/agent/quran";
import type { NakafaAgentQuranReferenceOptionsSchema } from "@repo/contents/_lib/agent/schemas";
import { Effect, Option } from "effect";
import type * as z from "zod";
import {
  toMcpReadModelError,
  toMcpStructuredResult,
  toMcpToolError,
} from "@/lib/mcp/result";
import {
  NakafaGetQuranReferenceInputSchema,
  NakafaGetQuranReferenceOutputSchema,
} from "@/lib/mcp/schemas";
import { NAKAFA_READ_ONLY_TOOL_ANNOTATIONS } from "@/lib/mcp/tool-config";

/** Registers the bounded Quran reference retrieval tool. */
export function registerNakafaGetQuranReferenceTool(server: McpServer) {
  server.registerTool(
    "nakafa_get_quran_reference",
    {
      annotations: NAKAFA_READ_ONLY_TOOL_ANNOTATIONS,
      description:
        "Return bounded Surah and verse data with Arabic text, transliteration, selected translation, optional tafsir, and canonical Nakafa URL.",
      inputSchema: NakafaGetQuranReferenceInputSchema.shape,
      outputSchema: NakafaGetQuranReferenceOutputSchema,
      title: "Get Nakafa Quran Reference",
    },
    (args) => runNakafaQuranReferenceTool(args)
  );
}

/** Runs Quran retrieval after enforcing the MCP range limit. */
function runNakafaQuranReferenceTool(
  args: z.infer<typeof NakafaAgentQuranReferenceOptionsSchema>
) {
  const lastVerse = args.to_verse ?? args.from_verse;
  const requestedVerseCount = lastVerse - args.from_verse + 1;

  if (lastVerse < args.from_verse) {
    return Effect.runPromise(
      Effect.succeed(
        toMcpToolError("Invalid Quran verse range.", [
          "`to_verse` must be greater than or equal to `from_verse`.",
        ])
      )
    );
  }

  if (requestedVerseCount > NAKAFA_AGENT_MAX_QURAN_REFERENCE_VERSES) {
    return Effect.runPromise(
      Effect.succeed(
        toMcpToolError("Quran reference range is too large.", [
          `Request at most ${NAKAFA_AGENT_MAX_QURAN_REFERENCE_VERSES} verses at a time.`,
          "Use `nakafa_get_content` with `https://nakafa.com/en/quran/{surah}` when you need a full surah.",
        ])
      )
    );
  }

  return Effect.runPromise(
    getNakafaAgentQuranReference(args).pipe(
      Effect.map(
        Option.match({
          onNone: () =>
            toMcpToolError("Nakafa Quran reference was not found.", [
              "Check that the surah number is between 1 and 114.",
              "Check that the requested verse numbers exist in the selected surah.",
            ]),
          onSome: toMcpStructuredResult,
        })
      ),
      Effect.catchTags({
        NakafaAgentInputError: (error) =>
          Effect.succeed(toMcpReadModelError(error)),
      })
    )
  );
}
