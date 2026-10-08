import { NAKAFA_MCP_EDGE_CONTRACT } from "@repo/backend/agent/edge";
import { registerNakafaMcpTools } from "@repo/backend/agent/mcp/tools";
import type { QueryRunner } from "@repo/backend/confect/_generated/services";
import {
  NAKAFA_MCP_SERVER_NAME,
  NAKAFA_MCP_SERVER_VERSION,
} from "@repo/contents/agent/constants";
import { type Context, Layer } from "effect";
import { McpProtocol, type McpSchema, McpServer } from "effect/ai";

const SERVER_INSTRUCTIONS =
  "Use Nakafa for cited educational content, lessons, articles, try-outs, and reviewed Quran references. Search first. Pass content_id to the content tool only when the result includes markdown_url. Cite try-out catalog results by URL without requesting private attempt content. Every capability is public and read-only.";

/**
 * Server identity that clients receive in discovery. McpServer passes its
 * options object as the server info (McpServer.ts line 820), so `title` reaches
 * the response. The golden discovery case guards that.
 */
const SERVER_IDENTITY: McpSchema.Implementation = {
  name: NAKAFA_MCP_SERVER_NAME,
  title: "Nakafa",
  version: NAKAFA_MCP_SERVER_VERSION,
};

/**
 * The Nakafa MCP engine for one request: Effect's Streamable HTTP server at the
 * protected origin path, with the Nakafa definitions registered on it. Handlers
 * run with the request services captured by the caller.
 */
export function nakafaMcpEngine(options: {
  readonly allowedOrigins: readonly string[];
  readonly requestId: string;
  readonly services: Context.Context<QueryRunner>;
}) {
  return Layer.effectDiscard(
    registerNakafaMcpTools(options.services, options.requestId)
  ).pipe(
    Layer.provide(
      McpServer.layerHttp({
        ...SERVER_IDENTITY,
        allowedOrigins: options.allowedOrigins,
        instructions: SERVER_INSTRUCTIONS,
        path: NAKAFA_MCP_EDGE_CONTRACT.originPath,
        protocols: [McpProtocol.v2026_07_28],
      })
    )
  );
}
