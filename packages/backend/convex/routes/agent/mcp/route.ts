import { NAKAFA_MCP_EDGE_CONTRACT } from "@repo/backend/agent/edge";
import type { ActionCtx } from "@repo/backend/convex/_generated/server";
import { enforceAgentReadLimit } from "@repo/backend/convex/routes/agent/limit";
import { guardMcpOrigin } from "@repo/backend/convex/routes/agent/mcp/guard";
import {
  mcpErrorResponse,
  mcpOptionsResponse,
  readJsonRpcRequestId,
  withMcpResponseHeaders,
} from "@repo/backend/convex/routes/agent/mcp/response";
import {
  NAKAFA_MCP_SERVER_NAME,
  NAKAFA_MCP_SERVER_VERSION,
} from "@repo/contents/_lib/agent/constants";
import {
  getUnknownErrorMessage,
  NakafaAgentDataReadError,
} from "@repo/contents/_lib/agent/errors";
import type { HonoWithConvex } from "convex-helpers/server/hono";
import { Effect, Result } from "effect";
import { Hono } from "hono";

type AgentApp = HonoWithConvex<ActionCtx, { requestId: string }>;

/** Registers the additive protected Streamable HTTP MCP successor. */
export function registerAgentMcpRoutes(app: AgentApp) {
  const mcp: AgentApp = new Hono();
  mcp.use("*", guardMcpOrigin);
  mcp.get("/health", (context) =>
    withMcpResponseHeaders(
      new Response(
        JSON.stringify({
          server: {
            name: NAKAFA_MCP_SERVER_NAME,
            version: NAKAFA_MCP_SERVER_VERSION,
          },
          status: "healthy",
          timestamp: new Date().toISOString(),
        }),
        {
          headers: { "Content-Type": "application/json; charset=utf-8" },
        }
      ),
      context.req.raw
    )
  );
  mcp.all("/", async (context) => {
    const request = context.req.raw;
    const requestId = context.get("requestId");
    if (request.method === "OPTIONS") {
      return mcpOptionsResponse(request);
    }
    const limited = await readRateLimit(context.env, request);
    if (limited.kind === "unavailable") {
      return withMcpResponseHeaders(
        mcpErrorResponse(
          503,
          -32_603,
          "The public MCP request limiter is unavailable.",
          requestId
        ),
        request
      );
    }
    if (limited.kind === "limited") {
      const responseId =
        request.method === "POST"
          ? await Effect.runPromise(readJsonRpcRequestId(request))
          : null;
      return withMcpResponseHeaders(
        mcpErrorResponse(
          429,
          -32_029,
          "The public MCP request limit was exceeded for this client.",
          requestId,
          responseId,
          limited.retryAfterMs
        ),
        request
      );
    }
    const runtime = await Effect.runPromise(
      loadMcpRuntime().pipe(Effect.result)
    );
    if (Result.isFailure(runtime)) {
      return withMcpResponseHeaders(
        mcpErrorResponse(
          503,
          -32_603,
          "The MCP protocol runtime is unavailable.",
          requestId
        ),
        request
      );
    }
    const legacy = await runtime.success.sdk.isLegacyRequest(request);
    if (!(legacy || request.headers.has("mcp-protocol-version"))) {
      const responseId = await Effect.runPromise(readJsonRpcRequestId(request));
      return withMcpResponseHeaders(
        mcpErrorResponse(
          400,
          -32_020,
          "The MCP-Protocol-Version header is required for modern requests.",
          requestId,
          responseId
        ),
        request
      );
    }
    const handler = runtime.success.sdk.createMcpHandler(
      () =>
        runtime.success.server.createNakafaMcpServer(context.env, requestId),
      {
        legacy: "stateless",
        onerror: (error) => {
          Effect.runSync(
            Effect.logWarning("Nakafa MCP protocol request failed.").pipe(
              Effect.annotateLogs({ errorName: error.name, requestId })
            )
          );
        },
      }
    );
    return withMcpResponseHeaders(await handler.fetch(request), request);
  });
  app.route(NAKAFA_MCP_EDGE_CONTRACT.originPath, mcp);
}

const loadMcpRuntime = Effect.fn("agent.mcp.loadRuntime")(() =>
  Effect.tryPromise({
    catch: (cause) =>
      new NakafaAgentDataReadError({
        cause: getUnknownErrorMessage(cause),
        message: "Unable to load the MCP protocol runtime.",
      }),
    try: () =>
      Promise.all([
        import("@modelcontextprotocol/server"),
        import("@repo/backend/agent/mcp/server"),
      ]).then(([sdk, server]) => ({ sdk, server })),
  })
);

function readRateLimit(ctx: ActionCtx, request: Request) {
  return Effect.runPromise(
    enforceAgentReadLimit(ctx, request).pipe(
      Effect.match({
        onFailure: (error) =>
          error._tag === "AgentRateLimitError"
            ? {
                kind: "limited" as const,
                retryAfterMs: error.retryAfterMs,
              }
            : { kind: "unavailable" as const },
        onSuccess: () => ({ kind: "allowed" as const }),
      })
    )
  );
}
