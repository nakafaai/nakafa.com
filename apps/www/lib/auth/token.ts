import {
  createNetworkRequestError,
  isRetryableNetworkError,
  NETWORK_ATTEMPT_DEADLINE,
  NETWORK_RETRY_SCHEDULE,
} from "@repo/backend/client/network";
import { FetchClient } from "@repo/utilities/http/client";
import { getSessionCookie } from "better-auth/cookies";
import { Data, Effect, Schema } from "effect";
import {
  HttpClient,
  type HttpClientError,
  HttpClientRequest,
  HttpClientResponse,
} from "effect/http";

/**
 * The Better Auth route that issues the Convex token, at the helper's default
 * base path.
 */
const TOKEN_PATH = "/api/auth/convex/token";

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

/** One attempt that failed in a way the retry schedule may run again. */
class RetryableTokenAttempt extends Data.TaggedError("RetryableTokenAttempt")<{
  readonly failure: SessionTokenUnavailable;
}> {}

const TokenResponseSchema = Schema.Struct({
  token: Schema.String,
});

/**
 * Prepares the headers as the installed helper prepares them before it calls the
 * token route, in @convex-dev/better-auth 0.12.5: `cachedGetToken` removes the
 * framing headers and sets `accept-encoding` (`src/nextjs/index.ts` lines 99 to
 * 103), and `getToken` sets `host` (`src/utils/index.ts` line 140).
 */
function tokenRequestHeaders(site: URL, requestHeaders: Headers) {
  const headers = new Headers(requestHeaders);
  headers.delete("content-length");
  headers.delete("transfer-encoding");
  headers.set("accept-encoding", "identity");
  headers.set("host", site.host);
  return headers;
}

/** Keeps only the retry classification of a rejected fetch, never its message. */
function classifyTransportFailure(error: HttpClientError.HttpClientError) {
  const failure = new SessionTokenUnavailable({ reason: "fetch" });
  return isRetryableNetworkError(createNetworkRequestError(error.reason.cause))
    ? new RetryableTokenAttempt({ failure })
    : failure;
}

/**
 * Classifies the token route's answer. A 200 must decode to a token, a 401 means
 * no session, a 5xx may be tried again, and every other status is final.
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
    return token;
  }
  const failure = new SessionTokenUnavailable({
    reason: "status",
    status: response.status,
  });
  if (response.status >= 500) {
    return yield* new RetryableTokenAttempt({ failure });
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
    .pipe(Effect.mapError(classifyTransportFailure));
  return yield* readTokenAnswer(response);
}, Effect.scoped);

/**
 * Runs one attempt, which ends at its deadline even when the route never
 * answers.
 */
const attemptTokenRequest = Effect.fn("www.auth.attemptTokenRequest")(
  function* (request: HttpClientRequest.HttpClientRequest) {
    return yield* sendTokenRequest(request).pipe(
      Effect.timeoutOrElse({
        duration: NETWORK_ATTEMPT_DEADLINE,
        orElse: () =>
          Effect.fail(
            new RetryableTokenAttempt({
              failure: new SessionTokenUnavailable({ reason: "deadline" }),
            })
          ),
      })
    );
  }
);

/**
 * Reads the Better Auth Convex token for one request. Without a session cookie
 * no request is sent and the token is `undefined`. Otherwise the token route
 * answers with the token, or with `undefined` for a 401. Any other answer fails
 * with `SessionTokenUnavailable`, so an outage never looks like a signed-out
 * visitor. A 5xx answer, a missed deadline, and a retryable network failure are
 * tried again on the shared schedule; the request is a read, so repeating it is
 * safe.
 */
export const readSessionToken = Effect.fn("www.auth.readSessionToken")(
  function* (siteUrl: string, requestHeaders: Headers) {
    if (getSessionCookie(requestHeaders) === null) {
      return;
    }
    const site = new URL(siteUrl);
    const request = HttpClientRequest.get(new URL(TOKEN_PATH, site), {
      headers: tokenRequestHeaders(site, requestHeaders),
    });
    return yield* attemptTokenRequest(request).pipe(
      Effect.retry({
        schedule: NETWORK_RETRY_SCHEDULE,
        while: (error) => error instanceof RetryableTokenAttempt,
      }),
      Effect.catchTag("RetryableTokenAttempt", ({ failure }) =>
        Effect.fail(failure)
      )
    );
  },
  Effect.provide(FetchClient)
);
