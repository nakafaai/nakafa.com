import { Context, Schema } from "effect";
import {
  HttpApi,
  HttpApiEndpoint,
  HttpApiGroup,
  HttpApiMiddleware,
  HttpApiSchema,
  HttpApiSecurity,
  OpenApi,
} from "effect/http-api";

/**
 * The school REST API (ADR 0006, ADR 0029): one `HttpApi` definition that the Convex
 * routes serve, the OpenAPI document describes, and the CLI's typed client calls. It
 * imports no Convex or server code, so a client can bundle it. A school host serves it at
 * `/api/v1` and forwards to the Convex site under `SCHOOL_API_PATH`.
 */
export const SCHOOL_API_PATH = "/api/school/v1";

/** The path the Convex site serves the school MCP server at; a school host forwards `/mcp` to it. */
export const SCHOOL_MCP_PATH = "/api/school/mcp";

/** The most rows one page holds; a request for more is clamped (ADR 0029, amendment rule 7). */
export const PAGE_LIMIT = 100;

/** The seconds one access token lives. */
export const TOKEN_SECONDS = 3600;

/** A bearer token that is missing, unknown, expired, or of a revoked client. */
export class SchoolApiUnauthorized extends Schema.TaggedError<SchoolApiUnauthorized>()(
  "SchoolApiUnauthorized",
  { message: Schema.String },
  { httpApiStatus: 401 }
) {}

/** A client past its request limit; `retryAfter` is in seconds. */
export class SchoolApiRateLimited extends Schema.TaggedError<SchoolApiRateLimited>()(
  "SchoolApiRateLimited",
  { message: Schema.String, retryAfter: Schema.Finite },
  { httpApiStatus: 429 }
) {}

/** A read the client's action list or scope does not open. */
export class SchoolApiForbidden extends Schema.TaggedError<SchoolApiForbidden>()(
  "SchoolApiForbidden",
  { message: Schema.String },
  { httpApiStatus: 403 }
) {}

/** The bearer token of one request, which the handler checks before it reads anything. */
export class SchoolApiToken extends Context.Service<
  SchoolApiToken,
  { readonly token: string }
>()("@repo/backend/confect/integrations/api/SchoolApiToken") {}

/**
 * The bearer security of every school API read. It hands the token to the handler, which
 * checks it and counts the request in the same request, because the Convex runners a check
 * needs reach a handler and never a middleware layer.
 */
export class SchoolApiBearer extends HttpApiMiddleware.Service<
  SchoolApiBearer,
  { provides: SchoolApiToken }
>()("@repo/backend/confect/integrations/api/SchoolApiBearer", {
  requiredForClient: true,
  security: { bearer: HttpApiSecurity.bearer },
}) {}

/** The refusals every roster read may answer: a closed read, a refused token, and a client past its limit. */
const ROSTER_ERRORS = [
  SchoolApiForbidden,
  SchoolApiUnauthorized,
  SchoolApiRateLimited,
];

/** The OAuth 2.0 error codes the token endpoint answers (RFC 6749 section 5.2, RFC 8707). */
const OAuthErrorCode = Schema.Literals([
  "invalid_client",
  "invalid_request",
  "invalid_target",
  "unsupported_grant_type",
]);

/** A refused token request, with the status RFC 6749 gives it. */
export class OAuthError extends Schema.TaggedError<OAuthError>()(
  "OAuthError",
  { error: OAuthErrorCode, error_description: Schema.String },
  { httpApiStatus: 400 }
) {}

/** A client that failed to authenticate: an unknown client, a wrong secret, or a revoked client. */
export class OAuthClientError extends Schema.TaggedError<OAuthClientError>()(
  "OAuthClientError",
  { error: Schema.Literal("invalid_client"), error_description: Schema.String },
  { httpApiStatus: 401 }
) {}

/** The client credentials grant (RFC 6749 section 4.4), form encoded, with the resource it asks for (RFC 8707). */
export const TokenRequest = Schema.Struct({
  client_id: Schema.String,
  client_secret: Schema.String,
  grant_type: Schema.String,
  resource: Schema.optional(Schema.String),
});

/** An access token for one resource. */
export const TokenResponse = Schema.Struct({
  access_token: Schema.String,
  expires_in: Schema.Finite,
  token_type: Schema.Literal("Bearer"),
});

/** The query of a paginated read: an opaque cursor and the page size. */
const PageQuery = {
  cursor: Schema.optional(Schema.String),
  limit: Schema.optional(Schema.FiniteFromString),
};

/** One page of a read: its rows and the cursor of the next page, or null on the last page. */
const pageOf = <S extends Schema.Top>(item: S) =>
  Schema.Struct({ data: Schema.Array(item), next: Schema.NullOr(Schema.String) });

/** One period of the school. */
export const ApiPeriod = Schema.Struct({
  end: Schema.String,
  id: Schema.String,
  name: Schema.String,
  start: Schema.String,
  status: Schema.String,
  unitId: Schema.String,
});

/** One cohort (rombel) of a period. */
export const ApiCohort = Schema.Struct({
  grade: Schema.Finite,
  id: Schema.String,
  name: Schema.String,
  periodId: Schema.String,
  status: Schema.String,
});

/** One Person of the school, with no email, as `PersonView` shows it (ADR 0029, amendment rule 6). */
export const ApiPerson = Schema.Struct({
  account: Schema.Literals(["claimed", "unclaimed"]),
  id: Schema.String,
  name: Schema.String,
  status: Schema.String,
});

/** One placement of a student in a cohort of a period. */
export const ApiPlacement = Schema.Struct({
  cohortId: Schema.String,
  periodId: Schema.String,
  personId: Schema.String,
});

/** The token endpoint, which takes the client's own credentials and no bearer token. */
export class OAuthGroup extends HttpApiGroup.make("oauth").add(
  HttpApiEndpoint.post("token", "/token", {
    error: [OAuthError, OAuthClientError],
    payload: TokenRequest.pipe(HttpApiSchema.asFormUrlEncoded()),
    success: TokenResponse,
  })
) {}

/** The roster reads that a client's action list opens: periods, cohorts, people, and placements. */
export class RosterGroup extends HttpApiGroup.make("roster")
  .add(
    HttpApiEndpoint.get("periods", "/periods", {
      error: ROSTER_ERRORS,
      query: PageQuery,
      success: pageOf(ApiPeriod),
    }),
    HttpApiEndpoint.get("cohorts", "/cohorts", {
      error: ROSTER_ERRORS,
      query: { ...PageQuery, period: Schema.String },
      success: pageOf(ApiCohort),
    }),
    HttpApiEndpoint.get("people", "/people", {
      error: ROSTER_ERRORS,
      query: {
        ...PageQuery,
        status: Schema.optional(Schema.Literals(["active", "suspended", "removed"])),
      },
      success: pageOf(ApiPerson),
    }),
    HttpApiEndpoint.get("placements", "/placements", {
      error: ROSTER_ERRORS,
      query: { ...PageQuery, period: Schema.String },
      success: pageOf(ApiPlacement),
    })
  )
  .middleware(SchoolApiBearer) {}

/** The school API: the token endpoint and the roster reads, under the Convex path of the school API. */
export class SchoolApi extends HttpApi.make("nakafa-school")
  .add(OAuthGroup)
  .add(RosterGroup)
  .prefix(SCHOOL_API_PATH)
  .annotateMerge(
    OpenApi.annotations({
      description:
        "School data of one Nakafa school. Ask /token for an access token with the client credentials grant, then send it as a bearer token.",
      title: "Nakafa School API",
      version: "1",
    })
  ) {}
