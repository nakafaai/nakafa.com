import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import {
  NAKAFA_MCP_SERVER_NAME,
  NAKAFA_MCP_SERVER_VERSION,
} from "@repo/backend/agent/mcp/identity";
import { env } from "@/env";
import { withMcpOriginGuard } from "@/lib/mcp/origin";
import { registerNakafaMcpServer } from "@/lib/mcp/server";

/** Handles stateless Streamable HTTP with the official MCP Web Standard transport. */
const mcpHandler = withMcpOriginGuard(async (request) => {
  const url = new URL(request.url);

  if (url.pathname !== "/mcp") {
    return new Response("Not found", { status: 404 });
  }

  if (request.method !== "POST") {
    return new Response(
      JSON.stringify({
        error: {
          code: -32_000,
          message: "Method not allowed.",
        },
        id: null,
        jsonrpc: "2.0",
      }),
      {
        headers: {
          "Content-Type": "application/json",
        },
        status: 405,
      }
    );
  }

  const server = new McpServer(
    {
      name: NAKAFA_MCP_SERVER_NAME,
      version: NAKAFA_MCP_SERVER_VERSION,
    },
    {
      capabilities: {
        prompts: {
          listChanged: true,
        },
        resources: {
          listChanged: true,
        },
        tools: {
          listChanged: true,
        },
      },
    }
  );
  const transport = new WebStandardStreamableHTTPServerTransport();

  registerNakafaMcpServer(server);
  await server.connect(transport);

  return await transport.handleRequest(request);
}, env.MCP_ALLOWED_ORIGINS);

export const GET = mcpHandler;
export const POST = mcpHandler;
export const DELETE = mcpHandler;
export const OPTIONS = mcpHandler;
