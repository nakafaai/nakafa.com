import {
  RetryableNetworkAttempt,
  retryNetworkAttempt,
} from "@repo/backend/client/network";
import { FetchClient } from "@repo/utilities/http/client";
import { Effect, Schema } from "effect";
import { HttpClient, HttpClientRequest, HttpClientResponse } from "effect/http";

/** The refresh route of Convex Auth, which answers the access token of the refresh cookie's session. */
const REFRESH_PATH = "/api/auth/refresh";

/**
 * The refresh route could not answer for a request that carries a session cookie.
 * It holds the reason and, when the route answered, its status: never a header,
 * a cookie, or a body. A 401 is the route's "no session" answer and is not this
 * error.
 */
export class SessionTokenUnavailable extends Schema.TaggedError<
  SessionTokenUnavailable,
  { readonly brand: unique symbol }
>()("SessionTokenUnavailable", {
  reason: Schema.Literals(["body", "deadline", "fetch", "status"]),
  status: Schema.optionalKey(Schema.Int),
}) {}

/** The refresh route's answer: the access token and its user, or `null` for a request whose session is missing or has ended. */
const TokenResponseSchema = Schema.Struct({
  tokens: Schema.NullOr(
    Schema.Struct({ accessToken: Schema.String, userId: Schema.String })
  ),
});

/**
 * Classifies the token route's answer. A 200 must decode to a token or to `null`,
 * which means no session, as a 401 does; a 5xx may be tried again, and every
 * other status is final.
 */
const readTokenAnswer = Effect.fn("www.auth.readTokenAnswer")(function* (
  response: HttpClientResponse.HttpClientResponse
) {
  if (response.status === 401) {
    return;
  }
  if (response.status === 200) {
    const { tokens } = yield* HttpClientResponse.schemaBodyJson(
      TokenResponseSchema
    )(response).pipe(
      Effect.mapError(() => new SessionTokenUnavailable({ reason: "body" }))
    );
    return tokens?.accessToken;
  }
  const failure = new SessionTokenUnavailable({
    reason: "status",
    status: response.status,
  });
  if (response.status >= 500) {
    return yield* new RetryableNetworkAttempt({ failure });
  }
  return yield* failure;
});

/** How a request that never reached an answer fails: once, or tried again. */
type TransportFailure = (
  cause: unknown
) => SessionTokenUnavailable | RetryableNetworkAttempt<SessionTokenUnavailable>;

/**
 * The browser's rule: every failure is tried again. A browser rejects a dropped
 * connection with a bare TypeError that names no network code, so no failure on
 * the way can be told apart from a dropped one, and Convex Auth keeps a
 * presented refresh token working until its successor is used, so a refresh
 * whose answer was lost may go again.
 */
const retryBrowserTransport: TransportFailure = () =>
  new RetryableNetworkAttempt({
    failure: new SessionTokenUnavailable({ reason: "fetch" }),
  });

/**
 * Sends one token request and reads its answer. The scope aborts a response
 * that is never read, so a 401 does not keep its connection open.
 */
const sendTokenRequest = Effect.fn("www.auth.sendTokenRequest")(function* (
  request: HttpClientRequest.HttpClientRequest,
  transportFailure: TransportFailure
) {
  const client = (yield* HttpClient.HttpClient).pipe(HttpClient.withScope);
  const response = yield* client
    .execute(request)
    .pipe(Effect.mapError((error) => transportFailure(error.reason.cause)));
  return yield* readTokenAnswer(response);
}, Effect.scoped);

/**
 * Sends one refresh request until it answers. The route answers with the
 * access token, or with `undefined` for a 401. Any other answer fails with
 * `SessionTokenUnavailable`, so an outage never looks like a signed-out visitor.
 * A 5xx answer, a missed deadline, and a retryable network failure are tried
 * again on the shared schedule.
 */
const sendUntilAnswered = Effect.fn("www.auth.sendUntilAnswered")(function* (
  request: HttpClientRequest.HttpClientRequest,
  transportFailure: TransportFailure
) {
  return yield* retryNetworkAttempt(
    sendTokenRequest(request, transportFailure),
    new SessionTokenUnavailable({ reason: "deadline" })
  );
}, Effect.provide(FetchClient));

/**
 * Reads the access token in the browser, for a page that renders only there.
 * The refresh cookie is not readable in the browser, so the refresh route of
 * the page's own host decides: the browser sends the cookie itself, and the
 * route answers `undefined` for a visitor with no session.
 */
export const readBrowserSessionToken = Effect.fn(
  "www.auth.readBrowserSessionToken"
)(function* (origin: string) {
  return yield* sendUntilAnswered(
    HttpClientRequest.post(new URL(REFRESH_PATH, origin)).pipe(
      HttpClientRequest.bodyJson({})
    ),
    retryBrowserTransport
  );
});
