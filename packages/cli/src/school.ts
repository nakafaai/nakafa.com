import {
  CLI_CLIENT_ID,
  DEVICE_GRANT,
  OAuthClientError,
  OAuthError,
  SCHOOL_API_PATH,
  SCHOOL_HOST_API_PATH,
  SchoolApi,
  SchoolApiBearer,
  type TokenResponse,
} from "@repo/backend/confect/integrations/api";
import {
  Array as Arr,
  Clock,
  Console,
  Duration,
  Effect,
  Match,
  Schema,
  String as Str,
} from "effect";
import { HttpClient, HttpClientRequest } from "effect/http";
import { HttpApiClient, HttpApiMiddleware } from "effect/http-api";
import { readSession, removeSession, storeSession } from "#cli/credentials";
import { SchoolError } from "#cli/error";

/** A school host as the CLI takes it: one host name, such as `harapan.nakafa.com`. */
export const SchoolHost = Schema.String.check(
  Schema.isPattern(/^[a-z0-9-]+(\.[a-z0-9-]+)+$/)
);

/** The seconds RFC 8628 adds to the polling interval at each `slow_down`. */
const SLOW_DOWN_SECONDS = 5;

/** The client of one school host: the one `SchoolApi` definition, its Convex path served at the host's API path. */
const schoolClient = (host: string) =>
  HttpApiClient.make(SchoolApi, {
    baseUrl: `https://${host}`,
    transformClient: HttpClient.mapRequest(
      HttpClientRequest.updateUrl(
        Str.replace(SCHOOL_API_PATH, SCHOOL_HOST_API_PATH)
      )
    ),
  });

/** The bearer token of the stored sign-in, on every read. */
const bearerLayer = (token: string) =>
  HttpApiMiddleware.layerClient(SchoolApiBearer, ({ next, request }) =>
    next(HttpClientRequest.bearerToken(request, token))
  );

/**
 * A failed school command as the CLI reports it: the OAuth error code and sentence of a
 * sign-in refusal (RFC 6749 section 5.2), or the name and message of any other failure.
 */
const refusalOf = (error: Error) =>
  Schema.is(OAuthError)(error) || Schema.is(OAuthClientError)(error)
    ? new SchoolError({ code: error.error, message: error.error_description })
    : new SchoolError({ code: error.name, message: error.message });

/**
 * Signs the CLI in to one school with the device grant (RFC 8628): it asks the school for
 * a device code, shows the user code and where the school's Admin types it, polls the
 * token endpoint at the interval the school names until the Admin connects or turns the
 * device away, and stores the token for the reads.
 */
export const loginSchool = Effect.fn("NakafaCli.school.login")(function* (
  host: typeof SchoolHost.Type
) {
  const client = yield* schoolClient(host);
  // A school host's first label is the school's address.
  const school = Arr.headNonEmpty(Str.split(".")(host));
  const device = yield* client.oauth
    .device({ payload: { client_id: CLI_CLIENT_ID, school } })
    .pipe(Effect.mapError(refusalOf));
  yield* Console.error(
    `Ask the school's Admin to open ${device.verification_uri}, choose Connect a device on the client this CLI reads as, and type ${device.user_code}.`
  );
  const poll = (
    seconds: number
  ): Effect.Effect<typeof TokenResponse.Type, SchoolError> =>
    Effect.sleep(Duration.seconds(seconds)).pipe(
      Effect.andThen(
        client.oauth.token({
          payload: {
            client_id: CLI_CLIENT_ID,
            device_code: device.device_code,
            grant_type: DEVICE_GRANT,
          },
        })
      ),
      Effect.catch((error) => {
        const refusal = refusalOf(error);
        if (refusal.code === "authorization_pending") {
          return poll(seconds);
        }
        if (refusal.code === "slow_down") {
          return poll(seconds + SLOW_DOWN_SECONDS);
        }
        return Effect.fail(refusal);
      })
    );
  const token = yield* poll(device.interval);
  const now = yield* Clock.currentTimeMillis;
  const expiresAt = now + Duration.toMillis(Duration.seconds(token.expires_in));
  yield* storeSession({ expiresAt, host, token: token.access_token });
  return { expires_at: expiresAt, school: host };
});

/** Signs the CLI out: the stored sign-in is removed. The token ends when the Admin revokes or rotates its client. */
export const logoutSchool = Effect.fn("NakafaCli.school.logout")(function* () {
  yield* removeSession();
  return { signed_out: true };
});

/** One roster read of the signed-in school, with the options its command takes. */
export const SchoolRead = Schema.Union([
  Schema.Struct({ read: Schema.Literal("periods") }),
  Schema.Struct({
    cursor: Schema.optional(Schema.String),
    period: Schema.String,
    read: Schema.Literal("cohorts"),
  }),
  Schema.Struct({
    cursor: Schema.optional(Schema.String),
    period: Schema.String,
    read: Schema.Literal("placements"),
  }),
  Schema.Struct({
    cursor: Schema.optional(Schema.String),
    read: Schema.Literal("people"),
    status: Schema.optional(
      Schema.Literals(["active", "suspended", "removed"])
    ),
  }),
]);

/** The cursor of a page query, when the command names one. */
const cursorOf = (cursor: string | undefined) =>
  cursor === undefined ? {} : { cursor };

/** Reads one page of the signed-in school's roster as the client the Admin connected the CLI to. */
export const readSchool = Effect.fn("NakafaCli.school.read")(function* (
  command: typeof SchoolRead.Type
) {
  const session = yield* readSession(yield* Clock.currentTimeMillis);
  // The client reads its middleware when it is made, so the bearer layer comes first.
  const client = yield* schoolClient(session.host).pipe(
    Effect.provide(bearerLayer(session.token))
  );
  const read = Match.value(command).pipe(
    Match.discriminatorsExhaustive("read")({
      cohorts: (found) =>
        client.roster.cohorts({
          query: { ...cursorOf(found.cursor), period: found.period },
        }),
      people: (found) =>
        client.roster.people({
          query: {
            ...cursorOf(found.cursor),
            ...(found.status === undefined ? {} : { status: found.status }),
          },
        }),
      periods: () => client.roster.periods({ query: {} }),
      placements: (found) =>
        client.roster.placements({
          query: { ...cursorOf(found.cursor), period: found.period },
        }),
    })
  );
  return yield* read.pipe(Effect.mapError(refusalOf));
});
