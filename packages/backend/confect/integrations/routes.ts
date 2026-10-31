import integrationsInternal from "@repo/backend/confect/_generated/refs/integrations.server";
import {
  MutationRunner,
  QueryRunner,
} from "@repo/backend/confect/_generated/services";
import {
  type ApiRosterImport,
  CLI_CLIENT_ID,
  DEVICE_GRANT,
  type ExportDataset,
  OAuthClientError,
  OAuthError,
  PAGE_LIMIT,
  SCHOOL_API_PATH,
  SchoolApi,
  SchoolApiBearer,
  SchoolApiConflict,
  SchoolApiForbidden,
  SchoolApiInvalid,
  SchoolApiRateLimited,
  SchoolApiToken,
  SchoolApiUnauthorized,
  type TokenResponse,
} from "@repo/backend/confect/integrations/api";
import {
  encodeCsv,
  encodeXlsx,
  readExport,
} from "@repo/backend/confect/integrations/exports";
import { pageOr } from "@repo/backend/confect/integrations/reads";
import { ImportRow } from "@repo/backend/confect/roster/schema";
import { TenantSlug } from "@repo/backend/confect/tenancy/slug";
import { sha256Hex } from "@repo/utilities/digest";
import { encodeJsonText } from "@repo/utilities/json";
import { Effect, Layer, Option, Redacted, Schema, String as Str } from "effect";
import { HttpApiBuilder } from "effect/http-api";

/** The token type of every access token. */
const BEARER = "Bearer";

/** The two halves of a user code, which a device shows as `XXXX-XXXX`. */
const USER_CODE_HALVES = /^(?<first>.{4})(?<second>.{4})$/u;

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
    const answer = yield* runMutation(integrationsInternal.tokens.issue, {
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
  const answer = yield* runMutation(integrationsInternal.devices.poll, {
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
            integrationsInternal.devices.start,
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
  const check = yield* runMutation(integrationsInternal.tokens.check, {
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
          const answer = yield* runQuery(integrationsInternal.reads.periods, {
            clientId: yield* callerId,
          }).pipe(Effect.orDie);
          return yield* pageOr(answer, forbidden);
        })
      )
      .handle("cohorts", ({ query }) =>
        Effect.gen(function* () {
          const { runQuery } = yield* QueryRunner;
          const answer = yield* runQuery(integrationsInternal.reads.cohorts, {
            clientId: yield* callerId,
            ...pageArgs(query),
            period: query.period,
          }).pipe(Effect.orDie);
          return yield* pageOr(answer, forbidden);
        })
      )
      .handle("people", ({ query }) =>
        Effect.gen(function* () {
          const { runQuery } = yield* QueryRunner;
          const answer = yield* runQuery(integrationsInternal.reads.people, {
            clientId: yield* callerId,
            ...pageArgs(query),
            status: query.status ?? "active",
          }).pipe(Effect.orDie);
          return yield* pageOr(answer, forbidden);
        })
      )
      .handle("placements", ({ query }) =>
        Effect.gen(function* () {
          const { runQuery } = yield* QueryRunner;
          const answer = yield* runQuery(
            integrationsInternal.reads.placements,
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

/** The reads of the school's record, each one internal query for the verified client. */
const recordsHandlers = HttpApiBuilder.group(
  SchoolApi,
  "records",
  Effect.fn(function* (handlers) {
    return handlers
      .handle("grades", ({ query }) =>
        Effect.gen(function* () {
          const { runQuery } = yield* QueryRunner;
          const answer = yield* runQuery(integrationsInternal.reads.grades, {
            clientId: yield* callerId,
            ...pageArgs(query),
            period: query.period,
          }).pipe(Effect.orDie);
          return yield* pageOr(answer, forbidden);
        })
      )
      .handle("changes", ({ query }) =>
        Effect.gen(function* () {
          const { runQuery } = yield* QueryRunner;
          const answer = yield* runQuery(integrationsInternal.reads.changes, {
            clientId: yield* callerId,
            ...pageArgs(query),
          }).pipe(Effect.orDie);
          return yield* pageOr(answer, forbidden);
        })
      );
  })
);

/**
 * One import for the verified client. The rows are read as students here, so a malformed row
 * answers 400 with nothing written, and the request's digest tells a repeat from another
 * request under the same `Idempotency-Key`.
 */
const importRoster = Effect.fn("integrations.routes.importRoster")(function* (
  key: string,
  payload: typeof ApiRosterImport.Type
) {
  const clientId = yield* callerId;
  const { runMutation } = yield* MutationRunner;
  const rows = yield* Schema.decodeUnknownEffect(Schema.Array(ImportRow))(
    payload.rows
  ).pipe(
    Effect.mapError(
      () =>
        new SchoolApiInvalid({ message: "A row does not read as a student." })
    )
  );
  const digest = yield* sha256Hex(encodeJsonText(payload)).pipe(Effect.orDie);
  const answer = yield* runMutation(integrationsInternal.writes.importRoster, {
    clientId,
    digest,
    key,
    period: payload.period,
    rows,
  }).pipe(Effect.orDie);
  if (answer.outcome === "forbidden") {
    return yield* forbidden();
  }
  if (answer.outcome === "conflict") {
    return yield* new SchoolApiConflict({
      message: "This key was used for another request.",
    });
  }
  return answer.summary;
});

/** The sheet of one export for the request's client, or the refusal of a read it may not make. */
const exportSheet = (request: {
  readonly params: { readonly dataset: typeof ExportDataset.Type };
  readonly query: { readonly period?: string | undefined };
}) =>
  Effect.gen(function* () {
    const sheet = yield* readExport(
      yield* callerId,
      request.params.dataset,
      request.query.period
    );
    return yield* Effect.fromOption(sheet).pipe(Effect.mapError(forbidden));
  });

/** The writes of the school API. */
const importsHandlers = HttpApiBuilder.group(
  SchoolApi,
  "imports",
  Effect.fn(function* (handlers) {
    return handlers.handle("roster", ({ headers, payload }) =>
      importRoster(headers["idempotency-key"], payload)
    );
  })
);

/** The exports, each one sheet in the file format its path names. */
const exportsHandlers = HttpApiBuilder.group(
  SchoolApi,
  "exports",
  Effect.fn(function* (handlers) {
    return handlers
      .handle("csv", (request) => Effect.map(exportSheet(request), encodeCsv))
      .handle("xlsx", (request) =>
        Effect.flatMap(exportSheet(request), encodeXlsx)
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
}).pipe(
  Layer.provide([
    exportsHandlers,
    importsHandlers,
    oauthHandlers,
    recordsHandlers,
    rosterHandlers,
  ]),
  Layer.provide(bearer)
);
