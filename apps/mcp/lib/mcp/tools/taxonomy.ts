import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { Nakafa } from "@repo/contents/_lib/agent/service";
import { Effect } from "effect";
import { toMcpStructuredResult } from "@/lib/mcp/result";
import {
  NakafaGetTaxonomyInputSchema,
  NakafaGetTaxonomyOutputSchema,
} from "@/lib/mcp/schemas";
import { NAKAFA_READ_ONLY_TOOL_ANNOTATIONS } from "@/lib/mcp/tool-config";

/** Registers the taxonomy and endpoint guidance tool. */
export function registerNakafaGetTaxonomyTool(server: McpServer) {
  server.registerTool(
    "nakafa_get_taxonomy",
    {
      annotations: NAKAFA_READ_ONLY_TOOL_ANNOTATIONS,
      description:
        "Return supported Nakafa locales, sections, categories, grades, materials, exercise types, counts, and MCP endpoint guidance.",
      inputSchema: NakafaGetTaxonomyInputSchema,
      outputSchema: NakafaGetTaxonomyOutputSchema,
      title: "Get Nakafa Taxonomy",
    },
    ({ locale }) =>
      Effect.runPromise(
        Nakafa.taxonomy(locale).pipe(
          Effect.provide(Nakafa.Default),
          Effect.map(toMcpStructuredResult)
        )
      )
  );
}
