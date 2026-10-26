import refs from "@repo/backend/confect/_generated/refs";
import {
  MutationRunner,
  QueryRunner,
} from "@repo/backend/confect/_generated/services";
import {
  OAuthClientError,
  OAuthError,
  PAGE_LIMIT,
  SCHOOL_API_PATH,
  SchoolApi,
  SchoolApiBearer,
  SchoolApiForbidden,
  SchoolApiRateLimited,
  SchoolApiToken,
  SchoolApiUnauthorized,
} from "@repo/backend/confect/integrations/api";
import { pageOr } from "@repo/backend/confect/integrations/reads";
import { Effect, Layer, Redacted } from "effect";
import { HttpApiBuilder } from "effect/http-api";

/** The token type of every access token. */
const BEARER = "Bearer";

/** The grant that the token endpoint serves: client credentials, and no other. */
const CLIENT_CREDENTIALS = "client_credentials";

/**
 * The token endpoint (ADR 0029): the client credentials grant, answered with an access
 * token for the resource that the request names. A grant of another type is refused as
 * `unsupported_grant_type`, before any client is read.
 */
const oauthHandlers = HttpApiBuilder.group(
  SchoolApi,
  "oauth",
  Effect.fn(function* (handlers) {
    return handlers.handle("token", ({ payload }) =>
      Effect.gen(function* () {
        if (payload.grant_type !== CLIENT_CREDENTIALS) {
          return yield* new OAuthError({
            error: "unsupported_grant_type",
            error_description: "Only the client_credentials grant is served.",
          });
        }
        const { runMutation } = yield* MutationRunner;
        const answer = yield* runMutation(
          refs.internal.integrations.tokens.issue,
          {
            clientId: payload.client_id,
            resource: payload.resource,
            secret: payload.client_secret,
          }
        ).pipe(Effect.orDie);
        if (answer.outcome === "refused") {
          return yield* answer.error === "invalid_client"
            ? new OAuthClientError({
                error: "invalid_client",
                error_description:
                  "The client is unknown or its secret is wrong.",
              })
            : new OAuthError({
                error: "invalid_target",
                error_description:
                  "The resource is not the API or the MCP server of this client's school.",
              });
        }
        return {
          access_token: answer.token,
          expires_in: answer.expiresIn,
          token_type: BEARER,
        };
      })
    );
  })
);

/** The page a read's query names: its cursor, or the first page, and its size, or a full page. */
const pageArgs = (query: {
  readonly cursor?: string | undefined;
  readonly limit?: number | undefined;
}) => ({ cursor: query.cursor ?? null, numItems: query.limit ?? PAGE_LIMIT });

/** The refusal of a read that the client's action list or scope does not open. */
const forbidden = () =>
  new SchoolApiForbidden({
    message: "This client may not read it.",
  });

/**
 * The client of the request's bearer token: the token must be live and issued for the REST
 * API, and the request is counted against its client's limit. A refused token answers 401,
 * and a client past its limit 429 with the seconds to wait.
 */
const callerId = Effect.gen(function* () {
  const { token } = yield* SchoolApiToken;
  const { runMutation } = yield* MutationRunner;
  const check = yield* runMutation(refs.internal.integrations.tokens.check, {
    resource: "api",
    token,
  }).pipe(Effect.orDie);
  if (check.outcome === "unauthorized") {
    return yield* new SchoolApiUnauthorized({
      message: "The bearer token is missing, unknown, or expired.",
    });
  }
  if (check.outcome === "limited") {
    return yield* new SchoolApiRateLimited({
      message: "This client sent too many requests.",
      retryAfter: check.retryAfter,
    });
  }
  return check.clientId;
});

/** The roster reads, each one internal query for the verified client. */
const rosterHandlers = HttpApiBuilder.group(
  SchoolApi,
  "roster",
  Effect.fn(function* (handlers) {
    return handlers
      .handle("periods", () =>
        Effect.gen(function* () {
          const { runQuery } = yield* QueryRunner;
          const answer = yield* runQuery(
            refs.internal.integrations.reads.periods,
            { clientId: yield* callerId }
          ).pipe(Effect.orDie);
          return yield* pageOr(answer, forbidden);
        })
      )
      .handle("cohorts", ({ query }) =>
        Effect.gen(function* () {
          const { runQuery } = yield* QueryRunner;
          const answer = yield* runQuery(
            refs.internal.integrations.reads.cohorts,
            {
              clientId: yield* callerId,
              ...pageArgs(query),
              period: query.period,
            }
          ).pipe(Effect.orDie);
          return yield* pageOr(answer, forbidden);
        })
      )
      .handle("people", ({ query }) =>
        Effect.gen(function* () {
          const { runQuery } = yield* QueryRunner;
          const answer = yield* runQuery(
            refs.internal.integrations.reads.people,
            {
              clientId: yield* callerId,
              ...pageArgs(query),
              status: query.status ?? "active",
            }
          ).pipe(Effect.orDie);
          return yield* pageOr(answer, forbidden);
        })
      )
      .handle("placements", ({ query }) =>
        Effect.gen(function* () {
          const { runQuery } = yield* QueryRunner;
          const answer = yield* runQuery(
            refs.internal.integrations.reads.placements,
            {
              clientId: yield* callerId,
              ...pageArgs(query),
              period: query.period,
            }
          ).pipe(Effect.orDie);
          return yield* pageOr(answer, forbidden);
        })
      );
  })
);

/** The bearer security: the token of the request, which each read checks with `callerId`. */
const bearer = Layer.succeed(
  SchoolApiBearer,
  SchoolApiBearer.of({
    bearer: (httpEffect, { credential }) =>
      Effect.provideService(httpEffect, SchoolApiToken, {
        token: Redacted.value(credential),
      }),
  })
);

/**
 * The routes of the school API on the Confect router, with the OpenAPI document of the
 * one definition at `/api/school/v1/openapi.json`, which needs no token (ADR 0029).
 */
export const schoolApiRoutes = HttpApiBuilder.layer(SchoolApi, {
  openapiPath: `${SCHOOL_API_PATH}/openapi.json`,
}).pipe(Layer.provide([oauthHandlers, rosterHandlers]), Layer.provide(bearer));
