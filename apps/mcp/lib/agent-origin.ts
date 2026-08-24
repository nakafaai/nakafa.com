import { NAKAFA_MCP_PROTOCOL_VERSION } from "@repo/backend/agent/mcp/protocol";
import {
  type AgentOriginProxyError,
  proxyAgentOriginRequest,
} from "@repo/backend/agent/proxy";
import { ConfigProvider, Effect } from "effect";
import { FetchHttpClient } from "effect/unstable/http";

const MCP_ERROR_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Expose-Headers": "MCP-Protocol-Version, MCP-Session-Id",
  "Cache-Control": "no-store",
  "Content-Type": "application/json; charset=utf-8",
  "MCP-Protocol-Version": NAKAFA_MCP_PROTOCOL_VERSION,
};

/** Maps one local adapter failure to a JSON-RPC HTTP response. */
function localMcpFailure(error: AgentOriginProxyError) {
  if (error.reason === "path") {
    return mcpErrorResponse(
      404,
      -32_601,
      "The local MCP adapter only serves /mcp."
    );
  }
  if (error.reason === "request-body") {
    return mcpErrorResponse(
      413,
      -32_600,
      "The local MCP request body exceeds two mebibytes."
    );
  }
  if (error.reason === "production") {
    return mcpErrorResponse(
      503,
      -32_603,
      "The local MCP adapter is disabled on Vercel production."
    );
  }
  if (error.reason === "configuration") {
    return mcpErrorResponse(
      503,
      -32_603,
      "The local MCP origin is not configured."
    );
  }
  return mcpErrorResponse(
    503,
    -32_603,
    "The selected local Convex MCP origin is unavailable."
  );
}

/** Creates one JSON-RPC transport error for the documented local command. */
function mcpErrorResponse(status: number, code: number, message: string) {
  return Response.json(
    {
      error: { code, message },
      id: null,
      jsonrpc: "2.0",
    },
    { headers: MCP_ERROR_HEADERS, status }
  );
}

/** Serves the documented local command without becoming a production proxy. */
export function proxyMcpRequest(request: Request) {
  return Effect.runPromise(
    proxyAgentOriginRequest(request, "mcp").pipe(
      Effect.catchTag("AgentOriginProxyError", (error) =>
        Effect.succeed(localMcpFailure(error))
      ),
      Effect.provideService(
        ConfigProvider.ConfigProvider,
        ConfigProvider.fromEnv()
      ),
      Effect.provideService(FetchHttpClient.Fetch, globalThis.fetch)
    )
  );
}
