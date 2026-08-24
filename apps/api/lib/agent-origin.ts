import {
  type AgentOriginProxyError,
  proxyAgentOriginRequest,
} from "@repo/backend/agent/proxy";
import { ConfigProvider, Effect } from "effect";
import { FetchHttpClient } from "effect/unstable/http";

/** Maps a local API adapter failure to one agent-readable Problem Details body. */
function localApiFailure(request: Request, error: AgentOriginProxyError) {
  const instance = new URL(request.url).pathname;
  const requestId = crypto.randomUUID();
  if (error.reason === "path") {
    return problemResponse({
      code: "NOT_FOUND",
      detail: "The local public API adapter only serves /v1 and /v1/*.",
      instance,
      requestId,
      resolution: "Retry with a Nakafa public API v1 path.",
      status: 404,
      title: "Not found",
      type: "not-found",
    });
  }
  if (error.reason === "request-body") {
    return problemResponse({
      code: "PAYLOAD_TOO_LARGE",
      detail: "The local adapter request body exceeds two mebibytes.",
      instance,
      requestId,
      resolution: "Retry with a smaller request body.",
      status: 413,
      title: "Payload too large",
      type: "payload-too-large",
    });
  }
  if (error.reason === "production") {
    return problemResponse({
      code: "LOCAL_PROXY_DISABLED",
      detail:
        "The Next.js public API adapter is disabled on Vercel production.",
      instance,
      requestId,
      resolution: "Use the configured Vercel external rewrite.",
      status: 503,
      title: "Service unavailable",
      type: "service-unavailable",
    });
  }
  if (error.reason === "configuration") {
    return problemResponse({
      code: "LOCAL_PROXY_CONFIGURATION_MISSING",
      detail: "The local Convex origin or API edge secret is not configured.",
      instance,
      requestId,
      resolution:
        "Set NAKAFA_CONVEX_SITE_URL and NAKAFA_API_EDGE_SECRET in apps/api/.env.local.",
      status: 503,
      title: "Service unavailable",
      type: "service-unavailable",
    });
  }
  return problemResponse({
    code: "LOCAL_PROXY_UNAVAILABLE",
    detail: "The selected local Convex public API origin is unavailable.",
    instance,
    requestId,
    resolution: "Start or select the isolated Convex deployment and retry.",
    status: 503,
    title: "Service unavailable",
    type: "service-unavailable",
  });
}

/** Creates one RFC 9457 response for the documented local API command. */
function problemResponse(input: {
  readonly code: string;
  readonly detail: string;
  readonly instance: string;
  readonly requestId: string;
  readonly resolution: string;
  readonly status: number;
  readonly title: string;
  readonly type: string;
}) {
  return Response.json(
    {
      code: input.code,
      detail: input.detail,
      instance: input.instance,
      request_id: input.requestId,
      resolution: input.resolution,
      status: input.status,
      title: input.title,
      type: `https://nakafa.com/problems/${input.type}`,
    },
    {
      headers: { "Content-Type": "application/problem+json; charset=utf-8" },
      status: input.status,
    }
  );
}

/** Serves the documented local command without becoming a production proxy. */
export function proxyPublicApiRequest(request: Request) {
  return Effect.runPromise(
    proxyAgentOriginRequest(request, "api").pipe(
      Effect.catchTag("AgentOriginProxyError", (error) =>
        Effect.succeed(localApiFailure(request, error))
      ),
      Effect.provideService(
        ConfigProvider.ConfigProvider,
        ConfigProvider.fromEnv()
      ),
      Effect.provideService(FetchHttpClient.Fetch, globalThis.fetch)
    )
  );
}
