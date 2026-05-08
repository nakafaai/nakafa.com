import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { Nakafa } from "@repo/contents/_lib/agent/service";
import { Effect } from "effect";
import {
  succeedMcpReadModelError,
  toMcpStructuredResult,
} from "@/lib/mcp/result";
import {
  NakafaSearchContentInputSchema,
  NakafaSearchContentOutputSchema,
} from "@/lib/mcp/schemas";
import { NAKAFA_READ_ONLY_TOOL_ANNOTATIONS } from "@/lib/mcp/tool-config";

/** Registers the content search tool. */
export function registerNakafaSearchContentTool(server: McpServer) {
  server.registerTool(
    "nakafa_search_content",
    {
      annotations: NAKAFA_READ_ONLY_TOOL_ANNOTATIONS,
      description:
        "Search the Nakafa public content index across articles, subjects, exercises, and Quran references. Returns bounded paginated summaries with stable content IDs.",
      inputSchema: NakafaSearchContentInputSchema,
      outputSchema: NakafaSearchContentOutputSchema,
      title: "Search Nakafa Content",
    },
    (args) => Effect.runPromise(getNakafaSearchContentToolResult(args))
  );
}

/** Builds a search tool result from untrusted MCP arguments. */
export function getNakafaSearchContentToolResult(args: unknown) {
  return Nakafa.search(args).pipe(
    Effect.provide(Nakafa.Default),
    Effect.map(toMcpStructuredResult),
    Effect.catchTags({
      NakafaAgentInputError: succeedMcpReadModelError,
    })
  );
}
