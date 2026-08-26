import {
  NAKAFA_DEFAULT_MCP_BROWSER_ORIGINS,
  NAKAFA_MCP_ALLOWED_ORIGINS_ENVIRONMENT,
  NAKAFA_MCP_EDGE_CONTRACT,
} from "@repo/backend/agent/edge";
import type { ActionCtx } from "@repo/backend/convex/_generated/server";
import { env } from "@repo/backend/convex/_generated/server";
import { mcpErrorResponse } from "@repo/backend/convex/routes/agent/mcp/response";
import { hasValidEdgeSecret } from "@repo/backend/convex/routes/agent/security";
import { NakafaAgentDataReadError } from "@repo/contents/_lib/agent/errors";
import { Effect } from "effect";
import type { MiddlewareHandler } from "hono";

const MAX_CONFIGURED_ORIGINS = 16;

/** Protects the MCP origin before transport parsing or server construction. */
export const guardMcpOrigin: MiddlewareHandler<{
  Bindings: ActionCtx;
  Variables: { requestId: string };
}> = async (context, next) => {
  const requestId = context.get("requestId");
  const result = await Effect.runPromise(
    readMcpGuard(context.req.raw).pipe(
      Effect.match({
        onFailure: () => "unavailable" as const,
        onSuccess: (value) => value,
      })
    )
  );
  if (result === "allowed") {
    return next();
  }
  if (result === "forbidden") {
    return mcpErrorResponse(
      403,
      -32_003,
      "Direct access to this Convex MCP origin is not allowed.",
      requestId
    );
  }
  if (result === "invalid-origin") {
    return mcpErrorResponse(
      403,
      -32_003,
      "The browser Origin is not trusted by this MCP server.",
      requestId
    );
  }
  return mcpErrorResponse(
    503,
    -32_603,
    "The MCP edge authentication boundary is unavailable.",
    requestId
  );
};

/** Validates the edge secret and optional exact browser Origin. */
const readMcpGuard = Effect.fn("agent.mcp.readGuard")(function* (
  request: Request
) {
  const validSecret = yield* hasValidEdgeSecret(
    request,
    NAKAFA_MCP_EDGE_CONTRACT
  );
  if (!validSecret) {
    return "forbidden" as const;
  }
  const origin = request.headers.get("origin");
  if (origin === null) {
    return "allowed" as const;
  }
  const allowed = yield* readTrustedOrigins();
  return allowed.has(origin)
    ? ("allowed" as const)
    : ("invalid-origin" as const);
});

/** Reads a strict exact-origin allow-list from typed Convex configuration. */
const readTrustedOrigins = Effect.fn("agent.mcp.readTrustedOrigins")(
  function* () {
    const configured = yield* Effect.sync(
      () => env[NAKAFA_MCP_ALLOWED_ORIGINS_ENVIRONMENT]
    );
    const allowed = new Set<string>(NAKAFA_DEFAULT_MCP_BROWSER_ORIGINS);
    if (configured === undefined) {
      return allowed;
    }
    const entries = configured.split(",").map((entry) => entry.trim());
    if (
      entries.length > MAX_CONFIGURED_ORIGINS ||
      entries.some((entry) => entry.length === 0)
    ) {
      return yield* invalidOrigins();
    }
    for (const entry of entries) {
      if (!URL.canParse(entry)) {
        return yield* invalidOrigins();
      }
      const url = new URL(entry);
      if (
        url.origin !== entry ||
        url.protocol !== "https:" ||
        url.username.length > 0 ||
        url.password.length > 0
      ) {
        return yield* invalidOrigins();
      }
      allowed.add(entry);
    }
    return allowed;
  }
);

function invalidOrigins() {
  return new NakafaAgentDataReadError({
    message: "The MCP browser Origin boundary is unavailable.",
  });
}
