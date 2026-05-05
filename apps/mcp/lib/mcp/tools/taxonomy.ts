import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { NakafaAgentTaxonomySchema } from "@repo/contents/_lib/agent/schemas";
import { getNakafaAgentTaxonomy } from "@repo/contents/_lib/agent/taxonomy";
import { Effect } from "effect";
import { toMcpStructuredResult } from "@/lib/mcp/result";
import { NakafaGetTaxonomyInputSchema } from "@/lib/mcp/schemas";
import { NAKAFA_READ_ONLY_TOOL_ANNOTATIONS } from "@/lib/mcp/tool-config";

/** Registers the taxonomy and endpoint guidance tool. */
export function registerNakafaGetTaxonomyTool(server: McpServer) {
  server.registerTool(
    "nakafa_get_taxonomy",
    {
      annotations: NAKAFA_READ_ONLY_TOOL_ANNOTATIONS,
      description:
        "Return supported Nakafa locales, sections, categories, grades, materials, exercise types, counts, and MCP endpoint guidance.",
      inputSchema: NakafaGetTaxonomyInputSchema.shape,
      outputSchema: NakafaAgentTaxonomySchema.shape,
      title: "Get Nakafa Taxonomy",
    },
    ({ locale }) =>
      Effect.runPromise(
        getNakafaAgentTaxonomy(locale).pipe(Effect.map(toMcpStructuredResult))
      )
  );
}
