import { McpServer } from "@modelcontextprotocol/server";
import { registerNakafaMcpPrompts } from "@repo/backend/agent/mcp/prompts";
import { registerNakafaMcpResources } from "@repo/backend/agent/mcp/resources";
import { registerNakafaMcpTools } from "@repo/backend/agent/mcp/tools";
import type { ActionCtx } from "@repo/backend/convex/_generated/server";
import {
  NAKAFA_MCP_SERVER_NAME,
  NAKAFA_MCP_SERVER_VERSION,
} from "@repo/contents/_lib/agent/constants";

const SERVER_INSTRUCTIONS =
  "Use Nakafa for cited educational content, lessons, articles, try-outs, and reviewed Quran references. Search first. Pass content_id to the content tool only when the result includes markdown_url. Cite try-out catalog results by URL without requesting private attempt content. Every capability is public and read-only.";

/** Creates one complete per-request MCP server over shared Convex programs. */
export function createNakafaMcpServer(ctx: ActionCtx, requestId: string) {
  const server = new McpServer(
    {
      name: NAKAFA_MCP_SERVER_NAME,
      title: "Nakafa",
      version: NAKAFA_MCP_SERVER_VERSION,
    },
    { instructions: SERVER_INSTRUCTIONS }
  );

  registerNakafaMcpTools(server, ctx, requestId);
  registerNakafaMcpResources(server, ctx);
  registerNakafaMcpPrompts(server);
  return server;
}
