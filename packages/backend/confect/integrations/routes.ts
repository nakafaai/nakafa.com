import refs from "@repo/backend/confect/_generated/refs";
import {
  MutationRunner,
  QueryRunner,
} from "@repo/backend/confect/_generated/services";
import {
  CLI_CLIENT_ID,
  DEVICE_GRANT,
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
  type TokenResponse,
} from "@repo/backend/confect/integrations/api";
import { pageOr } from "@repo/backend/confect/integrations/reads";
import { TenantSlug } from "@repo/backend/confect/tenancy/slug";
import { Effect, Layer, Option, Redacted, Schema, String as Str } from "effect";
import { HttpApiBuilder } from "effect/http-api";

/** The token type of every access token. */
const BEARER = "Bearer";

/** The two halves of a user code, which a device shows as `XXXX-XXXX`. */
const USER_CODE_HALVES = /^(.{4})(.{4})$/;

/** The client credentials grant (RFC 6749 section 4.4). */
const CLIENT_CREDENTIALS = "client_credentials";

/** A refusal of the device grant's token request, as RFC 8628 section 3.5 names it. */
const DEVICE_REFUSALS = {
  denied: {
    error: "access_denied",
    error_description: "The school's Admin denied this device.",
  },
  expired: {
    error: "expired_token",
    error_description: "The device code expired. Sign in again.",
  },
  pending: {
    error: "authorization_pending",
    error_description: "The school's Admin has not authorized this device yet.",
  },
  slow_down: {
    error: "slow_down",
    error_description: "Poll less often.",
  },
} as const;

/** The refusal of a request that names an unknown client, or a public client with a secret. */
const unknownClient = () =>
  new OAuthClientError({
    error: "invalid_client",
    error_description: "The client is unknown or its secret is wrong.",
  });

/** An access token as the token endpoint answers it. */
const tokenAnswer = (answer: {
  readonly expiresIn: number;
  readonly token: string;
}): typeof TokenResponse.Type => ({
  access_token: answer.token,
  expires_in: answer.expiresIn,
  token_type: BEARER,
});

/** The client credentials grant: the client's own secret, for the resource the request names. */
const clientCredentials = Effect.fn("integrations.routes.clientCredentials")(
  function* (clientId: string, secret: string, resource: string | undefined) {
    const { runMutation } = yield* MutationRunner;
    const answer = yield* runMutation(refs.internal.integrations.tokens.issue, {
      clientId,
      resource,
      secret,
    }).pipe(Effect.orDie);
    if (answer.outcome === "refused") {
      return yield* answer.error === "invalid_client"
        ? unknownClient()
        : new OAuthError({
            error: "invalid_target",
            error_description:
              "The resource is not the API or the MCP server of this client's school.",
          });
    }
    return tokenAnswer(answer);
  }
);

/** The device grant: one poll of the device code, answered with its client's token once the Admin authorized it. */
const deviceToken = Effect.fn("integrations.routes.deviceToken")(function* (
  deviceCode: string
) {
  const { runMutation } = yield* MutationRunner;
  const answer = yield* runMutation(refs.internal.integrations.devices.poll, {
    deviceCode,
  }).pipe(Effect.orDie);
  if (answer.outcome !== "issued") {
    return yield* new OAuthError(DEVICE_REFUSALS[answer.outcome]);
  }
  return tokenAnswer(answer);
});

/**
 * The token endpoint (ADR 0029): the client credentials grant with a client's secret, and
 * the device grant of the Nakafa CLI. Any other grant, or a grant without its credential, is
 * refused before any client is read. The device authorization endpoint starts the device
 * grant for one school.
 */
const oauthHandlers = HttpApiBuilder.group(
  SchoolApi,
  "oauth",
  Effect.fn(function* (handlers) {
    return handlers
      .handle("token", ({ payload }) =>
        Effect.gen(function* () {
          if (
            payload.grant_type === CLIENT_CREDENTIALS &&
            payload.client_secret !== undefined
          ) {
            return yield* clientCredentials(
              payload.client_id,
              payload.client_secret,
              payload.resource
            );
          }
          if (
            payload.grant_type === DEVICE_GRANT &&
            payload.device_code !== undefined
          ) {
            if (payload.client_id !== CLI_CLIENT_ID) {
              return yield* unknownClient();
            }
            return yield* deviceToken(payload.device_code);
          }
          return yield* new OAuthError({
            error: "unsupported_grant_type",
            error_description:
              "Send the client_credentials grant with a client secret, or the device grant with a device code.",
          });
        })
      )
      .handle("device", ({ payload }) =>
        Effect.gen(function* () {
          if (payload.client_id !== CLI_CLIENT_ID) {
            return yield* unknownClient();
          }
          const slug = Schema.decodeOption(TenantSlug)(payload.school);
          if (Option.isNone(slug)) {
            return yield* unknownSchool();
          }
          const { runMutation } = yield* MutationRunner;
          const answer = yield* runMutation(
            refs.internal.integrations.devices.start,
            { slug: slug.value }
          ).pipe(Effect.orDie);
          if (answer.outcome === "unknown") {
            return yield* unknownSchool();
          }
          return {
            device_code: answer.deviceCode,
            expires_in: answer.expiresIn,
            interval: answer.interval,
            user_code: Str.replace(USER_CODE_HALVES, "$1-$2")(answer.userCode),
            verification_uri: answer.verificationUri,
          };
        })
      );
  })
);

/** The refusal of a device request for a school that does not exist or is not active. */
const unknownSchool = () =>
  new OAuthError({
    error: "invalid_request",
    error_description: "No active school has this address.",
  });

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
