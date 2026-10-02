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
import { contentRoutes } from "@repo/backend/confect/routes/agent/content";
import { guardAgentApi } from "@repo/backend/confect/routes/agent/guard";
import { readTaxonomyInput } from "@repo/backend/confect/routes/agent/input";
import { quranRoutes } from "@repo/backend/confect/routes/agent/quran";
import {
  agentJsonResponse,
  agentOptionsResponse,
  problemResponse,
} from "@repo/backend/confect/routes/agent/response";
import {
  runAgentRequest,
  runMeteredRequest,
} from "@repo/backend/confect/routes/agent/runtime";
import { searchRoutes } from "@repo/backend/confect/routes/agent/search";
import {
  RequestIdentity,
  requestIdentity,
} from "@repo/backend/confect/routes/middleware/identity";
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
import { Clock, Effect, Layer } from "effect";
import { HttpRouter, HttpServerRequest, HttpServerResponse } from "effect/http";

/** Registers the protected read-only API and its machine-readable contract. */
const nonReadMethods = ["POST", "PUT", "PATCH", "DELETE", "HEAD"] as const;
const missingRoute = Effect.gen(function* () {
  const request = yield* HttpServerRequest.toWeb(
    yield* HttpServerRequest.HttpServerRequest
  );
  return HttpServerResponse.fromWeb(
    missingRouteResponse(request, yield* RequestIdentity)
  );
});
const apiRoutes = HttpRouter.addAll(
  [
    HttpRouter.route(
      "GET",
      "/",
      Effect.gen(function* () {
        const request = yield* HttpServerRequest.toWeb(
          yield* HttpServerRequest.HttpServerRequest
        );
        const requestId = yield* RequestIdentity;
        return HttpServerResponse.fromWeb(
          yield* runAgentRequest(
            request,
            requestId,
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
      })
    ),
    HttpRouter.route(
      "GET",
      "/health",
      Effect.gen(function* () {
        const request = yield* HttpServerRequest.toWeb(
          yield* HttpServerRequest.HttpServerRequest
        );
        const requestId = yield* RequestIdentity;
        const timestamp = yield* Clock.currentTimeMillis;
        return HttpServerResponse.fromWeb(
          yield* runAgentRequest(
            request,
            requestId,
            decodeAgentOutput(
              NakafaApiHealthSchema,
              {
                service: "nakafa-public-api",
                status: "ok",
                timestamp,
                version: NAKAFA_PUBLIC_API_VERSION,
              },
              "Unable to build the Nakafa API health response."
            ).pipe(Effect.map(agentJsonResponse))
          )
        );
      })
    ),
    HttpRouter.route(
      "GET",
      "/taxonomy",
      Effect.gen(function* () {
        const request = yield* HttpServerRequest.toWeb(
          yield* HttpServerRequest.HttpServerRequest
        );
        const requestId = yield* RequestIdentity;
        return HttpServerResponse.fromWeb(
          yield* runMeteredRequest(
            request,
            requestId,
            readTaxonomyInput(new URL(request.url)).pipe(
              Effect.flatMap((input) =>
                decodeAgentInput(
                  NakafaAgentTaxonomyOptionsSchema,
                  input,
                  "Invalid Nakafa taxonomy options."
                )
              ),
              Effect.flatMap(({ locale }) => getNakafaTaxonomy(locale)),
              Effect.map(agentJsonResponse)
            )
          )
        );
      })
    ),
    ...contentRoutes,
    ...searchRoutes,
    ...quranRoutes,
    ...(["/", "/health", "/taxonomy"] satisfies HttpRouter.PathInput[]).map(
      (path) =>
        HttpRouter.route(
          "OPTIONS",
          path,
          HttpServerResponse.fromWeb(agentOptionsResponse())
        )
    ),
    ...nonReadMethods.map((method) =>
      HttpRouter.route(method, "/", missingRoute)
    ),
    HttpRouter.route("*", "/:path/*", missingRoute),
  ],
  {
    prefix: `${NAKAFA_API_EDGE_CONTRACT.originPath}${NAKAFA_API_EDGE_CONTRACT.runtimePath}`,
  }
);
const documentPath: HttpRouter.PathInput = `${NAKAFA_API_EDGE_CONTRACT.originPath}${NAKAFA_API_EDGE_CONTRACT.documentPath}`;
const openApiPreflight = HttpRouter.route(
  "OPTIONS",
  documentPath,
  HttpServerResponse.fromWeb(createOpenApiOptionsResponse())
);
const documentRoutes = HttpRouter.addAll([
  ...nonReadMethods.map((method) =>
    HttpRouter.route(method, documentPath, missingRoute)
  ),
  HttpRouter.route(
    "GET",
    documentPath,
    Effect.gen(function* () {
      const request = yield* HttpServerRequest.HttpServerRequest;
      return HttpServerResponse.fromWeb(
        createOpenApiResponse(request.headers["if-none-match"])
      );
    })
  ),
  openApiPreflight,
]);
export const agentApiRoutes = Layer.mergeAll(apiRoutes, documentRoutes).pipe(
  Layer.provide(guardAgentApi.combine(requestIdentity).layer)
);

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
