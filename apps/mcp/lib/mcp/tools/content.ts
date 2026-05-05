import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { getNakafaAgentMarkdown } from "@repo/contents/_lib/agent/markdown";
import { Effect, Option } from "effect";
import {
  toMcpReadModelError,
  toMcpStructuredResult,
  toMcpToolError,
} from "@/lib/mcp/result";
import {
  NakafaGetContentInputSchema,
  NakafaGetContentOutputSchema,
} from "@/lib/mcp/schemas";
import { NAKAFA_READ_ONLY_TOOL_ANNOTATIONS } from "@/lib/mcp/tool-config";

/** Registers the full content markdown retrieval tool. */
export function registerNakafaGetContentTool(server: McpServer) {
  server.registerTool(
    "nakafa_get_content",
    {
      annotations: NAKAFA_READ_ONLY_TOOL_ANNOTATIONS,
      description:
        "Return full agent-readable markdown for a public Nakafa content ID, Nakafa URL, or nakafa://content resource URI.",
      inputSchema: NakafaGetContentInputSchema.shape,
      outputSchema: NakafaGetContentOutputSchema,
      title: "Get Nakafa Content",
    },
    ({ content_id_or_url }) =>
      Effect.runPromise(
        getNakafaAgentMarkdown(content_id_or_url).pipe(
          Effect.map(
            Option.match({
              onNone: () =>
                toMcpToolError("Nakafa content was not found.", [
                  "Call `nakafa_search_content` first and pass back the exact returned `content_id`.",
                  "Use a canonical Nakafa URL such as `https://nakafa.com/en/quran/1`.",
                ]),
              onSome: toMcpStructuredResult,
            })
          ),
          Effect.catchTags({
            NakafaAgentDataReadError: (error) =>
              Effect.succeed(toMcpReadModelError(error)),
            NakafaAgentInputError: (error) =>
              Effect.succeed(toMcpReadModelError(error)),
          })
        )
      )
  );
}
