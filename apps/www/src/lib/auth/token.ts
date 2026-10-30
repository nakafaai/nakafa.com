import {
  classifyNetworkFailure,
  RetryableNetworkAttempt,
  retryNetworkAttempt,
} from "@repo/backend/client/network";
import { FetchClient } from "@repo/utilities/http/client";
import { Effect, Schema } from "effect";
import { HttpClient, HttpClientRequest, HttpClientResponse } from "effect/http";
import { TOKEN_PATH } from "@/lib/auth/session";

/**
 * The token route could not answer for a request that carries a session cookie.
 * It holds the reason and, when the route answered, its status: never a header,
 * a cookie, or a body. A 401 is the route's "no session" answer and is not this
 * error.
 */
export class SessionTokenUnavailable extends Schema.TaggedError<SessionTokenUnavailable>()(
  "SessionTokenUnavailable",
  {
    reason: Schema.Literals(["body", "deadline", "fetch", "status"]),
    status: Schema.optionalKey(Schema.Int),
  }
) {}

/** The token route's 200 answer: the token, or `null` for a request whose session is missing or has ended. */
const TokenResponseSchema = Schema.Struct({
  token: Schema.NullOr(Schema.String),
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
    const { token } = yield* HttpClientResponse.schemaBodyJson(
      TokenResponseSchema
    )(response).pipe(
      Effect.mapError(() => new SessionTokenUnavailable({ reason: "body" }))
    );
    if (token === null) {
      return;
    }
    return token;
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

/**
 * Sends one token request and reads its answer. The scope aborts a response
 * that is never read, so a 401 does not keep its connection open.
 */
const sendTokenRequest = Effect.fn("www.auth.sendTokenRequest")(function* (
  request: HttpClientRequest.HttpClientRequest
) {
  const client = (yield* HttpClient.HttpClient).pipe(HttpClient.withScope);
  const response = yield* client
    .execute(request)
    .pipe(
      Effect.mapError((error) =>
        classifyNetworkFailure(
          error.reason.cause,
          new SessionTokenUnavailable({ reason: "fetch" })
        )
      )
    );
  return yield* readTokenAnswer(response);
}, Effect.scoped);

/**
 * Sends one token request until it answers. The token route answers with the
 * token, or with `undefined` for a 401. Any other answer fails with
 * `SessionTokenUnavailable`, so an outage never looks like a signed-out visitor.
 * A 5xx answer, a missed deadline, and a retryable network failure are tried
 * again on the shared schedule; the request is a read, so repeating it is safe.
 */
export const requestSessionToken = Effect.fn("www.auth.requestSessionToken")(
  function* (request: HttpClientRequest.HttpClientRequest) {
    return yield* retryNetworkAttempt(
      sendTokenRequest(request),
      new SessionTokenUnavailable({ reason: "deadline" })
    );
  },
  Effect.provide(FetchClient)
);

/**
 * Reads the Convex token in the browser, for a page that renders only there. The
 * session cookie is not readable in the browser, so the token route of the page's
 * own host decides: the browser sends the session cookie itself, and the route
 * answers `undefined` for a visitor with no session.
 */
export const readBrowserSessionToken = Effect.fn(
  "www.auth.readBrowserSessionToken"
)(function* (origin: string) {
  return yield* requestSessionToken(
    HttpClientRequest.get(new URL(TOKEN_PATH, origin))
  );
});
