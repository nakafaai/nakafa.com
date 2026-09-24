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
import { getNakafaTaxonomy } from "@repo/backend/agent/taxonomy";
import { registerAgentContentRoute } from "@repo/backend/convex/routes/agent/content";
import { guardAgentApi } from "@repo/backend/convex/routes/agent/guard";
import { readTaxonomyInput } from "@repo/backend/convex/routes/agent/input";
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
import { registerAgentSearchRoute } from "@repo/backend/convex/routes/agent/search";
import {
  NAKAFA_API_BASE_URL,
  NAKAFA_BASE_URL,
  NAKAFA_MCP_ENDPOINT,
  NAKAFA_PUBLIC_API_VERSION,
} from "@repo/contents/agent/constants";
import {
  NakafaApiHealthSchema,
  NakafaApiIndexSchema,
} from "@repo/contents/agent/schema/api";
import { NakafaAgentTaxonomyOptionsSchema } from "@repo/contents/agent/schema/taxonomy";
import { Effect } from "effect";
import { Hono } from "hono";

/** Registers the protected read-only API and its machine-readable contract. */
export function registerAgentApiRoutes(app: AgentApp) {
  const runtime: AgentApp = new Hono();

  runtime.use("*", guardAgentApi);

  runtime.get("/", (context) =>
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
          mcp: NAKAFA_MCP_ENDPOINT,
          name: "Nakafa Public API",
          openapi: `${NAKAFA_API_BASE_URL}/openapi.json`,
          status: "active",
          version: NAKAFA_PUBLIC_API_VERSION,
        },
        "Unable to build the Nakafa API index."
      ).pipe(Effect.map(agentJsonResponse))
    )
  );

  runtime.get("/health", (context) =>
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

  registerAgentSearchRoute(runtime);
  registerAgentContentRoute(runtime);

  runtime.get("/taxonomy", (context) =>
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

  registerAgentQuranRoutes(runtime);

  for (const path of ["/", "/health", "/taxonomy"]) {
    runtime.options(path, () => agentOptionsResponse());
  }

  runtime.all("*", (context) =>
    missingRouteResponse(context.req.raw, context.get("requestId"))
  );

  const document: AgentApp = new Hono();
  document.use("*", guardAgentApi);
  document.get("/", (context) =>
    createOpenApiResponse(context.req.header("if-none-match"))
  );
  document.options("/", () => createOpenApiOptionsResponse());

  app.route(
    `${NAKAFA_API_EDGE_CONTRACT.originPath}${NAKAFA_API_EDGE_CONTRACT.documentPath}`,
    document
  );
  app.route(
    `${NAKAFA_API_EDGE_CONTRACT.originPath}${NAKAFA_API_EDGE_CONTRACT.runtimePath}`,
    runtime
  );
}

/** Returns the missing endpoint after the method guard has admitted a read. */
function missingRouteResponse(request: Request, requestId: string) {
  return problemResponse({
    code: "ENDPOINT_NOT_FOUND",
    detail: "The requested public API endpoint does not exist.",
    instance: projectPublicApiPath(new URL(request.url).pathname),
    requestId,
    resolution: "Consult https://api.nakafa.com/openapi.json.",
    status: 404,
    title: "Endpoint not found",
    type: "endpoint-not-found",
  });
}
