import { getNakafaContent } from "@repo/backend/agent/content";
import {
  decodeAgentInput,
  decodeAgentOutput,
} from "@repo/backend/agent/decode";
import {
  createOpenApiOptionsResponse,
  createOpenApiResponse,
} from "@repo/backend/agent/openapi/response";
import { getNakafaQuranReference } from "@repo/backend/agent/quran";
import { searchNakafaContent } from "@repo/backend/agent/search";
import { getNakafaTaxonomy } from "@repo/backend/agent/taxonomy";
import type { ActionCtx } from "@repo/backend/convex/_generated/server";
import { guardAgentApi } from "@repo/backend/convex/routes/agent/guard";
import {
  type AgentHttpInputError,
  readContentInput,
  readQuranInput,
  readSearchInput,
  readTaxonomyInput,
} from "@repo/backend/convex/routes/agent/input";
import {
  type AgentRateLimitError,
  enforceAgentReadLimit,
} from "@repo/backend/convex/routes/agent/limit";
import {
  agentFailureResponse,
  agentJsonResponse,
  agentOptionsResponse,
  httpInputFailureResponse,
  logInternalFailure,
  problemResponse,
} from "@repo/backend/convex/routes/agent/response";
import {
  NAKAFA_API_BASE_URL,
  NAKAFA_BASE_URL,
  NAKAFA_MCP_RECOMMENDED_ENDPOINT,
  NAKAFA_PUBLIC_API_VERSION,
} from "@repo/contents/_lib/agent/constants";
import type {
  NakafaAgentDataReadError,
  NakafaAgentInputError,
} from "@repo/contents/_lib/agent/errors";
import {
  NakafaApiHealthSchema,
  NakafaApiIndexSchema,
} from "@repo/contents/_lib/agent/schema/api";
import { NakafaAgentTaxonomyOptionsSchema } from "@repo/contents/_lib/agent/schema/taxonomy";
import type { HonoWithConvex } from "convex-helpers/server/hono";
import { Cause, Effect, Option } from "effect";

type AgentDomainError =
  | AgentHttpInputError
  | AgentRateLimitError
  | NakafaAgentDataReadError
  | NakafaAgentInputError;
type AgentApp = HonoWithConvex<ActionCtx, { requestId: string }>;

/** Registers the protected read-only API and its machine-readable contract. */
export function registerAgentApiRoutes(app: AgentApp) {
  app.use("/openapi.json", guardAgentApi);
  app.use("/v1", guardAgentApi);
  app.use("/v1/*", guardAgentApi);

  app.get("/openapi.json", (context) =>
    createOpenApiResponse(context.req.header("if-none-match"))
  );
  app.options("/openapi.json", () => createOpenApiOptionsResponse());

  app.get("/v1", (context) =>
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

  app.get("/v1/health", (context) =>
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

  app.get("/v1/search", (context) =>
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

  app.get("/v1/content", (context) =>
    runMeteredRequest(
      context.env,
      context.req.raw,
      context.get("requestId"),
      readContentInput(new URL(context.req.url)).pipe(
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

  app.get("/v1/taxonomy", (context) =>
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

  app.get("/v1/quran/:surah", (context) =>
    runMeteredRequest(
      context.env,
      context.req.raw,
      context.get("requestId"),
      readQuranInput(new URL(context.req.url), context.req.param("surah")).pipe(
        Effect.flatMap((input) => getNakafaQuranReference(context.env, input)),
        Effect.map(
          Option.match({
            onNone: () =>
              quranNotFoundResponse(context.req.raw, context.get("requestId")),
            onSome: agentJsonResponse,
          })
        )
      )
    )
  );

  for (const path of [
    "/v1",
    "/v1/health",
    "/v1/search",
    "/v1/content",
    "/v1/taxonomy",
    "/v1/quran/:surah",
  ]) {
    app.options(path, () => agentOptionsResponse());
  }

  app.all("/v1/*", (context) =>
    missingRouteResponse(context.req.raw, context.get("requestId"))
  );
}

/** Applies the application quota before reading or parsing content input. */
function runMeteredRequest(
  ctx: ActionCtx,
  request: Request,
  requestId: string,
  program: Effect.Effect<Response, AgentDomainError>
) {
  return runAgentRequest(
    request,
    requestId,
    enforceAgentReadLimit(ctx, request).pipe(Effect.flatMap(() => program))
  );
}

/** Runs one typed agent program at the Hono HTTP Action boundary. */
function runAgentRequest(
  request: Request,
  requestId: string,
  program: Effect.Effect<Response, AgentDomainError>
) {
  const instance = new URL(request.url).pathname;
  return Effect.runPromise(
    program.pipe(
      Effect.matchCauseEffect({
        onFailure: (cause) => {
          const failure = cause.reasons.find(Cause.isFailReason);
          if (!failure) {
            return logInternalFailure(cause, instance, requestId);
          }
          return Effect.succeed(
            failure.error._tag === "AgentHttpInputError"
              ? httpInputFailureResponse(failure.error, instance, requestId)
              : agentFailureResponse(failure.error, instance, requestId)
          );
        },
        onSuccess: Effect.succeed,
      })
    )
  );
}

/** Returns a stable missing-content problem. */
function contentNotFoundResponse(request: Request, requestId: string) {
  return problemResponse({
    code: "CONTENT_NOT_FOUND",
    detail: "No public Nakafa content matched the supplied reference.",
    instance: new URL(request.url).pathname,
    requestId,
    resolution:
      "Use a content_id from /v1/search with markdown_url, or a canonical readable Nakafa URL.",
    status: 404,
    title: "Content not found",
    type: "content-not-found",
  });
}

/** Returns a stable missing-Quran-reference problem. */
function quranNotFoundResponse(request: Request, requestId: string) {
  return problemResponse({
    code: "QURAN_REFERENCE_NOT_FOUND",
    detail: "The requested Quran reference was not found.",
    instance: new URL(request.url).pathname,
    requestId,
    resolution: "Pass a surah number from 1 through 114.",
    status: 404,
    title: "Quran reference not found",
    type: "quran-reference-not-found",
  });
}

/** Returns one exact 404 or 405 for unmatched public API routes. */
function missingRouteResponse(request: Request, requestId: string) {
  const instance = new URL(request.url).pathname;
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
