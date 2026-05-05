import { NAKAFA_MCP_SERVER_NAME } from "@repo/contents/_lib/agent/constants";
import { createMcpHandler } from "mcp-handler";
import { env } from "@/env";
import { withMcpOriginGuard } from "@/lib/mcp/origin";
import { registerNakafaMcpServer } from "@/lib/mcp/server";
import packageJson from "@/package.json";

const mcpHandler = createMcpHandler(
  registerNakafaMcpServer,
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
    serverInfo: {
      name: NAKAFA_MCP_SERVER_NAME,
      version: packageJson.version,
    },
  },
  {
    basePath: "",
    disableSse: true,
    maxDuration: 60,
    redisUrl: env.REDIS_URL,
    verboseLogs: false,
  }
);

const handler = withMcpOriginGuard(mcpHandler, env.MCP_ALLOWED_ORIGINS);

export const GET = handler;
export const POST = handler;
export const DELETE = handler;
export const OPTIONS = handler;
