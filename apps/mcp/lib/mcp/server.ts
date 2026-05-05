import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerNakafaMcpPrompts } from "@/lib/mcp/prompts";
import { registerNakafaMcpResources } from "@/lib/mcp/resources";
import { registerNakafaGetContentTool } from "@/lib/mcp/tools/content";
import { registerNakafaGetExerciseTool } from "@/lib/mcp/tools/exercise";
import { registerNakafaGetQuranReferenceTool } from "@/lib/mcp/tools/quran";
import { registerNakafaSearchContentTool } from "@/lib/mcp/tools/search";
import { registerNakafaGetTaxonomyTool } from "@/lib/mcp/tools/taxonomy";

/** Registers the complete public Nakafa MCP surface. */
export function registerNakafaMcpServer(server: McpServer) {
  registerNakafaSearchContentTool(server);
  registerNakafaGetContentTool(server);
  registerNakafaGetTaxonomyTool(server);
  registerNakafaGetExerciseTool(server);
  registerNakafaGetQuranReferenceTool(server);
  registerNakafaMcpResources(server);
  registerNakafaMcpPrompts(server);
}
