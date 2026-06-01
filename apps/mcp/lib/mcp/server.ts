import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerNakafaMcpPrompts } from "@/lib/mcp/prompts";
import { registerNakafaMcpResources } from "@/lib/mcp/resources";
import { registerNakafaMcpTools } from "@/lib/mcp/tools/register";

/** Registers the complete public Nakafa MCP surface. */
export function registerNakafaMcpServer(server: McpServer) {
  registerNakafaMcpTools(server);
  registerNakafaMcpResources(server);
  registerNakafaMcpPrompts(server);
}
