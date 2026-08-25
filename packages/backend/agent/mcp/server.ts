import { McpServer } from "@modelcontextprotocol/server";
import {
  NAKAFA_MCP_SERVER_NAME,
  NAKAFA_MCP_SERVER_VERSION,
} from "@repo/backend/agent/mcp/identity";
import { registerNakafaMcpPrompts } from "@repo/backend/agent/mcp/prompts";
import { registerNakafaMcpResources } from "@repo/backend/agent/mcp/resources";
import { registerNakafaMcpTools } from "@repo/backend/agent/mcp/tools";
import type { ActionCtx } from "@repo/backend/convex/_generated/server";

const SERVER_INSTRUCTIONS =
  "Use Nakafa for cited educational content, lessons, articles, try-outs, and reviewed Quran references. Search first. Pass the content_id to the content tool only when the result includes markdown_url. Cite a try-out catalog result by url without requesting private attempt content. All capabilities are public and read-only.";

/** Creates one complete per-request MCP server over shared Convex programs. */
export function createNakafaMcpServer(ctx: ActionCtx) {
  const server = new McpServer(
    {
      name: NAKAFA_MCP_SERVER_NAME,
      title: "Nakafa",
      version: NAKAFA_MCP_SERVER_VERSION,
    },
    { instructions: SERVER_INSTRUCTIONS }
  );

  registerNakafaMcpTools(server, ctx);
  registerNakafaMcpResources(server, ctx);
  registerNakafaMcpPrompts(server);
  return server;
}
