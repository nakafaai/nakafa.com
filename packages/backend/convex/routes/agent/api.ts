import { getNakafaContent } from "@repo/backend/agent/content";
import { decodeAgentInput } from "@repo/backend/agent/decode";
import { NAKAFA_API_EDGE_CONTRACT } from "@repo/backend/agent/edge";
import {
  NAKAFA_OPENAPI_ETAG,
  NAKAFA_OPENAPI_JSON,
  NAKAFA_PUBLIC_API_VERSION,
} from "@repo/backend/agent/openapi/document";
import { getNakafaQuranReference } from "@repo/backend/agent/quran";
import { searchNakafaContent } from "@repo/backend/agent/search";
import { getNakafaTaxonomy } from "@repo/backend/agent/taxonomy";
import type { ActionCtx } from "@repo/backend/convex/_generated/server";
import {
  type AgentHttpInputError,
  hasUnsupportedRequestMediaType,
  readContentInput,
  readQuranInput,
  readSearchInput,
  readTaxonomyInput,
} from "@repo/backend/convex/routes/agent/input";
import { limitAgentRequest } from "@repo/backend/convex/routes/agent/rateLimit";
import {
  agentFailureResponse,
  agentJsonResponse,
  agentOptionsResponse,
  httpInputFailureResponse,
  internalFailureResponse,
  problemResponse,
} from "@repo/backend/convex/routes/agent/response";
import { hasValidEdgeSecret } from "@repo/backend/convex/routes/agent/security";
import { requestId } from "@repo/backend/convex/routes/middleware/requestId";
import {
  NAKAFA_API_BASE_URL,
  NAKAFA_MCP_RECOMMENDED_ENDPOINT,
} from "@repo/contents/_lib/agent/constants";
import type {
  NakafaAgentDataReadError,
  NakafaAgentInputError,
} from "@repo/contents/_lib/agent/errors";
import { NakafaAgentTaxonomyOptionsSchema } from "@repo/contents/_lib/agent/schema/taxonomy";
import { negotiateMediaType } from "@repo/utilities/http/accept";
import type { HonoWithConvex } from "convex-helpers/server/hono";
import { Cause, Effect, Option } from "effect";
import { Hono, type MiddlewareHandler } from "hono";

type AgentDomainError =
  | AgentHttpInputError
  | NakafaAgentDataReadError
  | NakafaAgentInputError;
interface AgentHonoEnvironment {
  Bindings: ActionCtx;
  Variables: { requestId: string };
}
type AgentHono = Hono<AgentHonoEnvironment>;

const API_DOCUMENTATION_URL = "https://nakafa.com/developers";
const v1: AgentHono = new Hono();

/** Protects direct origin access and validates representation metadata. */
v1.use("*", requestId);
v1.use("*", async (c, next) => {
  const request = c.req.raw;
  const instance = new URL(request.url).pathname;
  const requestId = c.get("requestId");
  const secret = await Effect.runPromise(
    hasValidEdgeSecret(request, NAKAFA_API_EDGE_CONTRACT).pipe(
      Effect.match({
        onFailure: () => null,
        onSuccess: (valid) => valid,
      })
    )
  );
  if (secret === null) {
    return problemResponse({
      code: "SERVICE_UNAVAILABLE",
      detail: "The public edge authentication boundary is unavailable.",
      instance,
      requestId,
      resolution: "Retry through https://api.nakafa.com later.",
      status: 503,
      title: "Service unavailable",
      type: "service-unavailable",
    });
  }
  if (!secret) {
    return problemResponse({
      code: "ORIGIN_ACCESS_DENIED",
      detail: "Direct access to this Convex origin is not allowed.",
      instance,
      requestId,
      resolution: "Send the request through https://api.nakafa.com.",
      status: 403,
      title: "Forbidden",
      type: "origin-access-denied",
    });
  }
  if (request.method !== "GET" && request.method !== "OPTIONS") {
    return problemResponse({
      code: "METHOD_NOT_ALLOWED",
      detail: "The Nakafa public API supports GET and OPTIONS only.",
      headers: { Allow: "GET, OPTIONS" },
      instance,
      requestId,
      resolution: "Retry this endpoint with GET or OPTIONS.",
      status: 405,
      title: "Method not allowed",
      type: "method-not-allowed",
    });
  }
  if (
    !negotiateMediaType(request.headers.get("accept"), ["application/json"])
  ) {
    return problemResponse({
      code: "NOT_ACCEPTABLE",
      detail: "The public API returns application/json responses.",
      instance,
      requestId,
      resolution: "Send Accept: application/json or Accept: */*.",
      status: 406,
      title: "Not acceptable",
      type: "not-acceptable",
    });
  }
  if (hasUnsupportedRequestMediaType(request)) {
    return problemResponse({
      code: "UNSUPPORTED_MEDIA_TYPE",
      detail: "The declared request media type is not supported.",
      instance,
      requestId,
      resolution:
        "Remove the request body or use Content-Type: application/json.",
      status: 415,
      title: "Unsupported media type",
      type: "unsupported-media-type",
    });
  }
  return next();
});
const enforceApiRateLimit: MiddlewareHandler<AgentHonoEnvironment> = async (
  c,
  next
) => {
  const request = c.req.raw;
  if (request.method !== "GET") {
    return next();
  }
  const decision = await Effect.runPromise(
    limitAgentRequest(c.env, request, "api").pipe(
      Effect.match({
        onFailure: () => null,
        onSuccess: (result) => result,
      })
    )
  );
  const instance = new URL(request.url).pathname;
  const requestId = c.get("requestId");
  if (decision === null) {
    return problemResponse({
      code: "SERVICE_UNAVAILABLE",
      detail: "The public request limiter is unavailable.",
      instance,
      requestId,
      resolution: `Retry through ${NAKAFA_API_BASE_URL} later.`,
      status: 503,
      title: "Service unavailable",
      type: "service-unavailable",
    });
  }
  if (!decision.allowed) {
    const retryAfter = Math.max(
      1,
      Math.ceil(decision.retryAfterMilliseconds / 1000)
    );
    return problemResponse({
      code: "RATE_LIMITED",
      detail: "The public request limit was exceeded for this client.",
      headers: { "Retry-After": String(retryAfter) },
      instance,
      requestId,
      resolution: `Retry after ${retryAfter} seconds and use exponential backoff.`,
      status: 429,
      title: "Too many requests",
      type: "rate-limited",
    });
  }
  return next();
};

v1.use("/search", enforceApiRateLimit);
v1.use("/content", enforceApiRateLimit);
v1.use("/taxonomy", enforceApiRateLimit);
v1.use("/quran/*", enforceApiRateLimit);

v1.get("/", () =>
  agentJsonResponse({
    authentication: "none",
    description:
      "Read-only access to Nakafa's signed educational content for developers and agents.",
    docs: API_DOCUMENTATION_URL,
    documentation: API_DOCUMENTATION_URL,
    mcp: NAKAFA_MCP_RECOMMENDED_ENDPOINT,
    name: "Nakafa Public API",
    openapi: `${NAKAFA_API_BASE_URL}/openapi.json`,
    status: "active",
    version: NAKAFA_PUBLIC_API_VERSION,
  })
);

v1.get("/health", () =>
  agentJsonResponse({
    service: "nakafa-public-api",
    status: "ok",
    timestamp: Date.now(),
    version: NAKAFA_PUBLIC_API_VERSION,
  })
);

v1.get("/search", (c) =>
  runAgentRequest(
    c.req.raw,
    c.get("requestId"),
    readSearchInput(new URL(c.req.url)).pipe(
      Effect.flatMap((input) => searchNakafaContent(c.env, input)),
      Effect.map(agentJsonResponse)
    )
  )
);

v1.get("/content", (c) =>
  runAgentRequest(
    c.req.raw,
    c.get("requestId"),
    readContentInput(new URL(c.req.url)).pipe(
      Effect.flatMap((ref) => getNakafaContent(c.env, ref)),
      Effect.map(
        Option.match({
          onNone: () =>
            problemResponse({
              code: "CONTENT_NOT_FOUND",
              detail:
                "No public Nakafa content matched the supplied reference.",
              instance: new URL(c.req.url).pathname,
              requestId: c.get("requestId"),
              resolution:
                "Use a content_id from a /v1/search result with markdown_url, or use a canonical readable Nakafa URL.",
              status: 404,
              title: "Content not found",
              type: "content-not-found",
            }),
          onSome: agentJsonResponse,
        })
      )
    )
  )
);

v1.get("/taxonomy", (c) =>
  runAgentRequest(
    c.req.raw,
    c.get("requestId"),
    readTaxonomyInput(new URL(c.req.url)).pipe(
      Effect.flatMap((input) =>
        decodeAgentInput(
          NakafaAgentTaxonomyOptionsSchema,
          input,
          "Invalid Nakafa taxonomy options."
        )
      ),
      Effect.flatMap(({ locale }) => getNakafaTaxonomy(c.env, locale)),
      Effect.map(agentJsonResponse)
    )
  )
);

v1.get("/quran/:surah", (c) =>
  runAgentRequest(
    c.req.raw,
    c.get("requestId"),
    readQuranInput(new URL(c.req.url), c.req.param("surah")).pipe(
      Effect.flatMap((input) => getNakafaQuranReference(c.env, input)),
      Effect.map(
        Option.match({
          onNone: () =>
            problemResponse({
              code: "QURAN_REFERENCE_NOT_FOUND",
              detail: "The requested Quran reference was not found.",
              instance: new URL(c.req.url).pathname,
              requestId: c.get("requestId"),
              resolution: "Pass a surah number from 1 through 114.",
              status: 404,
              title: "Quran reference not found",
              type: "quran-reference-not-found",
            }),
          onSome: agentJsonResponse,
        })
      )
    )
  )
);

v1.options("/", () => agentOptionsResponse());
v1.options("/health", () => agentOptionsResponse());
v1.options("/search", () => agentOptionsResponse());
v1.options("/content", () => agentOptionsResponse());
v1.options("/taxonomy", () => agentOptionsResponse());
v1.options("/quran/:surah", () => agentOptionsResponse());

v1.all("*", (c) => {
  const instance = new URL(c.req.url).pathname;
  const requestId = c.get("requestId");
  if (c.req.method === "GET" || c.req.method === "OPTIONS") {
    return problemResponse({
      code: "ENDPOINT_NOT_FOUND",
      detail: "The requested public API endpoint does not exist.",
      instance,
      requestId,
      resolution: "Consult https://api.nakafa.com/openapi.json.",
      status: 404,
      title: "Endpoint not found",
      type: "endpoint-not-found",
    });
  }
  return problemResponse({
    code: "METHOD_NOT_ALLOWED",
    detail: "The Nakafa public API supports GET and OPTIONS only.",
    headers: { Allow: "GET, OPTIONS" },
    instance,
    requestId,
    resolution: "Retry this endpoint with GET or OPTIONS.",
    status: 405,
    title: "Method not allowed",
    type: "method-not-allowed",
  });
});

/** Runs one typed agent program at the Hono HTTP Action boundary. */
function runAgentRequest(
  request: Request,
  requestId: string,
  program: Effect.Effect<Response, AgentDomainError>
) {
  const instance = new URL(request.url).pathname;
  return Effect.runPromise(
    program.pipe(
      Effect.matchCause({
        onFailure: (cause) => {
          const failure = cause.reasons.find(Cause.isFailReason);
          if (!failure) {
            return internalFailureResponse(instance, requestId);
          }
          return failure.error._tag === "AgentHttpInputError"
            ? httpInputFailureResponse(failure.error, instance, requestId)
            : agentFailureResponse(failure.error, instance, requestId);
        },
        onSuccess: (response) => response,
      })
    )
  );
}

/** Registers the protected read-only API and public OpenAPI contract. */
export function registerAgentApiRoutes(app: HonoWithConvex<ActionCtx>) {
  app.get("/openapi.json", (c) => {
    if (c.req.header("if-none-match") === NAKAFA_OPENAPI_ETAG) {
      return new Response(null, {
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Cache-Control": "public, max-age=3600, s-maxage=3600",
          ETag: NAKAFA_OPENAPI_ETAG,
          Vary: "Accept, Accept-Encoding",
        },
        status: 304,
      });
    }
    return new Response(NAKAFA_OPENAPI_JSON, {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Cache-Control": "public, max-age=3600, s-maxage=3600",
        "Content-Type": "application/json; charset=utf-8",
        ETag: NAKAFA_OPENAPI_ETAG,
        Vary: "Accept, Accept-Encoding",
      },
    });
  });
  app.options("/openapi.json", () => agentOptionsResponse());
  app.route("/v1", v1);
}
