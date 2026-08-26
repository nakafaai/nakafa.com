import { NAKAFA_MCP_EDGE_CONTRACT } from "@repo/backend/agent/edge";
import type { ActionCtx } from "@repo/backend/convex/_generated/server";
import { enforceAgentReadLimit } from "@repo/backend/convex/routes/agent/limit";
import { guardMcpOrigin } from "@repo/backend/convex/routes/agent/mcp/guard";
import { readMcpRequest } from "@repo/backend/convex/routes/agent/mcp/input";
import type {
  LegacyRecordArgs,
  LegacyRecordResult,
} from "@repo/backend/convex/routes/agent/mcp/legacy";
import {
  mcpErrorResponse,
  mcpOptionsResponse,
  mcpParsedErrorResponse,
  mcpRateLimitResponse,
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
import { makeFunctionReference } from "convex/server";
import type { HonoWithConvex } from "convex-helpers/server/hono";
import { Effect, Result } from "effect";
import { Hono } from "hono";

type AgentApp = HonoWithConvex<ActionCtx, { requestId: string }>;

const recordLegacyReadReference = makeFunctionReference<
  "mutation",
  LegacyRecordArgs,
  LegacyRecordResult
>("routes/agent/mcp/legacy:record");

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
      return withMcpResponseHeaders(
        mcpRateLimitResponse(limited.retryAfterMs),
        request
      );
    }
    const bounded = await Effect.runPromise(
      readMcpRequest(request).pipe(Effect.result)
    );
    if (Result.isFailure(bounded)) {
      const oversized = bounded.failure.reason === "size";
      return withMcpResponseHeaders(
        mcpErrorResponse(
          oversized ? 413 : 400,
          oversized ? -32_013 : -32_700,
          oversized
            ? "The MCP request body exceeds the Nakafa byte limit."
            : "The MCP request body could not be read.",
          requestId
        ),
        request
      );
    }
    const { parsedBody, request: boundedRequest } = bounded.success;
    const runtime = await Effect.runPromise(
      loadMcpRuntime().pipe(Effect.result)
    );
    if (Result.isFailure(runtime)) {
      return withMcpResponseHeaders(
        mcpParsedErrorResponse(
          parsedBody,
          503,
          -32_603,
          "The MCP protocol runtime is unavailable.",
          requestId
        ),
        request
      );
    }
    const legacy = await runtime.success.sdk.isLegacyRequest(
      boundedRequest,
      parsedBody
    );
    if (!(legacy || request.headers.has("mcp-protocol-version"))) {
      return withMcpResponseHeaders(
        mcpParsedErrorResponse(
          parsedBody,
          400,
          -32_020,
          "The MCP-Protocol-Version header is required for modern requests.",
          requestId
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
    const response = await handler.fetch(boundedRequest, { parsedBody });
    if (legacy && response.ok) {
      const recorded = await Effect.runPromise(
        recordSuccessfulLegacyResponse(context.env).pipe(Effect.result)
      );
      if (Result.isFailure(recorded)) {
        return withMcpResponseHeaders(
          mcpParsedErrorResponse(
            parsedBody,
            503,
            -32_603,
            "The MCP legacy observation boundary is unavailable.",
            requestId
          ),
          request
        );
      }
    }
    return withMcpResponseHeaders(response, request);
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

/** Records every successful 2025 response before it leaves the HTTP action. */
const recordSuccessfulLegacyResponse = Effect.fn(
  "agent.mcp.recordSuccessfulLegacyResponse"
)(function* (ctx: ActionCtx) {
  yield* Effect.tryPromise({
    catch: (cause) =>
      new NakafaAgentDataReadError({
        cause: getUnknownErrorMessage(cause),
        message: "Unable to record successful MCP legacy usage.",
      }),
    try: () => ctx.runMutation(recordLegacyReadReference, {}),
  });
});
