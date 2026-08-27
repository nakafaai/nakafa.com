import { getNakafaContent } from "@repo/backend/agent/content";
import {
  decodeAgentInput,
  decodeAgentOutput,
} from "@repo/backend/agent/decode";
import {
  NAKAFA_API_EDGE_CONTRACT,
  projectPublicApiPath,
} from "@repo/backend/agent/edge";
import {
  createOpenApiOptionsResponse,
  createOpenApiResponse,
} from "@repo/backend/agent/openapi/response";
import { searchNakafaContent } from "@repo/backend/agent/search";
import { getNakafaTaxonomy } from "@repo/backend/agent/taxonomy";
import { guardAgentApi } from "@repo/backend/convex/routes/agent/guard";
import {
  readContentInput,
  readSearchInput,
  readTaxonomyInput,
} from "@repo/backend/convex/routes/agent/input";
import { registerAgentQuranRoutes } from "@repo/backend/convex/routes/agent/quran";
import {
  agentJsonResponse,
  agentOptionsResponse,
  problemResponse,
} from "@repo/backend/convex/routes/agent/response";
import {
  type AgentApp,
  runAgentRequest,
  runMeteredRequest,
} from "@repo/backend/convex/routes/agent/runtime";
import {
  NAKAFA_API_BASE_URL,
  NAKAFA_BASE_URL,
  NAKAFA_MCP_RECOMMENDED_ENDPOINT,
  NAKAFA_PUBLIC_API_VERSION,
} from "@repo/contents/_lib/agent/constants";
import {
  NakafaApiHealthSchema,
  NakafaApiIndexSchema,
} from "@repo/contents/_lib/agent/schema/api";
import { NakafaAgentContentRefInputSchema } from "@repo/contents/_lib/agent/schema/read";
import { NakafaAgentTaxonomyOptionsSchema } from "@repo/contents/_lib/agent/schema/taxonomy";
import { Effect, Option } from "effect";
import { Hono } from "hono";

/** Registers the protected read-only API and its machine-readable contract. */
export function registerAgentApiRoutes(app: AgentApp) {
  const api: AgentApp = new Hono();

  api.use("/openapi.json", guardAgentApi);
  api.use("/v1", guardAgentApi);
  api.use("/v1/*", guardAgentApi);
  api.use("/v2", guardAgentApi);
  api.use("/v2/*", guardAgentApi);

  api.get("/openapi.json", (context) =>
    createOpenApiResponse(context.req.header("if-none-match"))
  );
  api.options("/openapi.json", () => createOpenApiOptionsResponse());

  api.get("/v1", (context) =>
    runAgentRequest(
      context.req.raw,
      context.get("requestId"),
      decodeAgentOutput(
        NakafaApiIndexSchema,
        {
          authentication: "none",
          description:
            "Read-only access to Nakafa's signed educational content for developers and agents.",
          documentation: `${NAKAFA_BASE_URL}/llms.txt`,
          mcp: NAKAFA_MCP_RECOMMENDED_ENDPOINT,
          name: "Nakafa Public API",
          openapi: `${NAKAFA_API_BASE_URL}/openapi.json`,
          status: "active",
          version: NAKAFA_PUBLIC_API_VERSION,
        },
        "Unable to build the Nakafa API index."
      ).pipe(Effect.map(agentJsonResponse))
    )
  );

  api.get("/v1/health", (context) =>
    runAgentRequest(
      context.req.raw,
      context.get("requestId"),
      decodeAgentOutput(
        NakafaApiHealthSchema,
        {
          service: "nakafa-public-api",
          status: "ok",
          timestamp: Date.now(),
          version: NAKAFA_PUBLIC_API_VERSION,
        },
        "Unable to build the Nakafa API health response."
      ).pipe(Effect.map(agentJsonResponse))
    )
  );

  api.get("/v1/search", (context) =>
    runMeteredRequest(
      context.env,
      context.req.raw,
      context.get("requestId"),
      readSearchInput(new URL(context.req.url)).pipe(
        Effect.flatMap((input) => searchNakafaContent(context.env, input)),
        Effect.map(agentJsonResponse)
      )
    )
  );

  api.get("/v1/content", (context) =>
    runMeteredRequest(
      context.env,
      context.req.raw,
      context.get("requestId"),
      readContentInput(new URL(context.req.url)).pipe(
        Effect.flatMap((ref) =>
          decodeAgentInput(
            NakafaAgentContentRefInputSchema,
            ref,
            "Invalid Nakafa content reference."
          )
        ),
        Effect.flatMap((ref) => getNakafaContent(context.env, ref)),
        Effect.map(
          Option.match({
            onNone: () =>
              contentNotFoundResponse(
                context.req.raw,
                context.get("requestId")
              ),
            onSome: agentJsonResponse,
          })
        )
      )
    )
  );

  api.get("/v1/taxonomy", (context) =>
    runMeteredRequest(
      context.env,
      context.req.raw,
      context.get("requestId"),
      readTaxonomyInput(new URL(context.req.url)).pipe(
        Effect.flatMap((input) =>
          decodeAgentInput(
            NakafaAgentTaxonomyOptionsSchema,
            input,
            "Invalid Nakafa taxonomy options."
          )
        ),
        Effect.flatMap(({ locale }) => getNakafaTaxonomy(context.env, locale)),
        Effect.map(agentJsonResponse)
      )
    )
  );

  registerAgentQuranRoutes(api);

  for (const path of [
    "/v1",
    "/v1/health",
    "/v1/search",
    "/v1/content",
    "/v1/taxonomy",
  ]) {
    api.options(path, () => agentOptionsResponse());
  }

  api.all("/v1/*", (context) =>
    missingRouteResponse(context.req.raw, context.get("requestId"))
  );
  api.all("/v2", (context) =>
    missingRouteResponse(context.req.raw, context.get("requestId"))
  );
  api.all("/v2/*", (context) =>
    missingRouteResponse(context.req.raw, context.get("requestId"))
  );

  app.route(NAKAFA_API_EDGE_CONTRACT.originPath, api);
}

/** Returns a stable missing-content problem. */
function contentNotFoundResponse(request: Request, requestId: string) {
  return problemResponse({
    code: "CONTENT_NOT_FOUND",
    detail: "No public Nakafa content matched the supplied reference.",
    instance: projectPublicApiPath(new URL(request.url).pathname),
    requestId,
    resolution:
      "Use a content_id from /v1/search with markdown_url, or a canonical readable Nakafa URL.",
    status: 404,
    title: "Content not found",
    type: "content-not-found",
  });
}

/** Returns one exact 404 or 405 for unmatched public API routes. */
function missingRouteResponse(request: Request, requestId: string) {
  const instance = projectPublicApiPath(new URL(request.url).pathname);
  if (request.method === "GET" || request.method === "OPTIONS") {
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
}
