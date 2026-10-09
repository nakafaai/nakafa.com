import {
  NAKAFA_DEFAULT_MCP_BROWSER_ORIGINS,
  NAKAFA_MCP_ALLOWED_ORIGINS_ENVIRONMENT,
  NAKAFA_MCP_EDGE_CONTRACT,
} from "@repo/backend/agent/edge";
import { mcpTransportErrorResponse } from "@repo/backend/confect/routes/agent/mcp/response";
import { hasValidEdgeSecret } from "@repo/backend/confect/routes/agent/security";
import { NakafaAgentDataReadError } from "@repo/contents/agent/errors";
import { Array as Arr, Config, Effect, MutableHashSet, Option } from "effect";
import { HttpRouter, HttpServerRequest, HttpServerResponse } from "effect/http";

const MAX_CONFIGURED_ORIGINS = 16;

/** Protects the MCP origin before transport parsing or server construction. */
export const guardMcpOrigin = HttpRouter.middleware((handler) =>
  Effect.gen(function* () {
    const request = yield* HttpServerRequest.toWeb(
      yield* HttpServerRequest.HttpServerRequest
    );
    const result = yield* readMcpGuard(request).pipe(
      Effect.match({
        onFailure: () => "unavailable" as const,
        onSuccess: (value) => value,
      })
    );
    if (result === "allowed") {
      return yield* handler;
    }
    return HttpServerResponse.fromWeb(
      mcpTransportErrorResponse(result === "unavailable" ? 503 : 403)
    );
  })
);

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
  return MutableHashSet.has(allowed, origin)
    ? ("allowed" as const)
    : ("invalid-origin" as const);
});

/** Reads a strict exact-origin allow-list from typed Convex configuration. */
const readTrustedOrigins = Effect.fn("agent.mcp.readTrustedOrigins")(
  function* () {
    const configured = yield* Config.option(
      Config.String(NAKAFA_MCP_ALLOWED_ORIGINS_ENVIRONMENT)
    ).pipe(Effect.map(Option.getOrUndefined), Effect.mapError(invalidOrigins));
    const allowed = MutableHashSet.fromIterable<string>(
      NAKAFA_DEFAULT_MCP_BROWSER_ORIGINS
    );
    if (configured === undefined) {
      return allowed;
    }
    const entries = Arr.map(configured.split(","), (entry) => entry.trim());
    if (
      entries.length > MAX_CONFIGURED_ORIGINS ||
      Arr.some(entries, (entry) => entry.length === 0)
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
      MutableHashSet.add(allowed, entry);
    }
    return allowed;
  }
);
function invalidOrigins() {
  return NakafaAgentDataReadError.make({
    message: "The MCP browser Origin boundary is unavailable.",
  });
}
