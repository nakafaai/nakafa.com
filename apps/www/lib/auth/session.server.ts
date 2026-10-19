import "@tanstack/react-start/server-only";
import {
  classifyNetworkFailure,
  RetryableNetworkAttempt,
  retryNetworkAttempt,
} from "@repo/backend/client/network";
import { getSessionCookie } from "better-auth/cookies";
import { Array as Arr, Effect, Option, Result, Schema } from "effect";
import { FetchHttpClient } from "effect/http";
import { SESSION_PATH } from "@/lib/auth/session";
import { readSessionToken } from "@/lib/auth/token";
import { ClientSession } from "@/lib/auth/visitor";
import { CONVEX_SITE_URL } from "@/lib/server/runtime";

/** The session of one request could not be read: a network failure, an error status, a missed deadline or an unreadable answer. */
export class SessionUnavailable extends Schema.TaggedError<SessionUnavailable>()(
  "SessionUnavailable",
  {
    reason: Schema.Literals(["body", "deadline", "fetch", "status"]),
    status: Schema.optionalKey(Schema.Int),
  }
) {}

/** The session of one request on the server: what a page may see, the Convex token when there is one, and every Set-Cookie value to send back. */
const RequestSession = Schema.Struct({
  client: ClientSession,
  convexToken: Schema.Option(Schema.String),
  setCookies: Schema.Array(Schema.String),
});

/** One answer of the Convex site's session route: every Set-Cookie value, in order, and the JSON text of the body. */
const SessionAnswer = Schema.Struct({
  setCookies: Schema.Array(Schema.String),
  text: Schema.String,
});

type SessionAnswer = typeof SessionAnswer.Type;

/** The Better Auth session of the session route, or null for a visitor. */
const SessionJson = Schema.fromJsonString(
  Schema.NullOr(
    Schema.Struct({
      session: Schema.Struct({ id: Schema.String }),
      user: Schema.Struct({ id: Schema.String, name: Schema.String }),
    })
  )
);

/** The cookie that Better Auth's Convex plugin writes beside the session. */
const CONVEX_JWT_COOKIE = "convex_jwt";

/** The colon that ends the scheme of a URL protocol, such as `https:`. */
const PROTOCOL_COLON = /:$/u;

/** The session of a visitor, with the Set-Cookie values of the answer that produced it. */
function signedOut(setCookies: readonly string[]) {
  return RequestSession.make({
    client: ClientSession.cases.SignedOut.make({}),
    convexToken: Option.none(),
    setCookies: [...setCookies],
  });
}

/**
 * The headers of one request to the Convex site. The host is the site's own, as
 * the Better Auth helper sets it. The forwarded host and scheme name the address
 * that the browser asked for, so the site writes its cookies for that host.
 */
function siteHeaders(request: Request, site: URL) {
  const headers = new Headers(request.headers);
  const address = new URL(request.url);
  headers.delete("content-length");
  headers.delete("transfer-encoding");
  headers.set("host", site.host);
  headers.set("x-forwarded-host", address.host);
  headers.set(
    "x-forwarded-proto",
    address.protocol.replace(PROTOCOL_COLON, "")
  );
  return headers;
}

/**
 * Sends one session read and reads its whole answer, so the body is read inside
 * the attempt's deadline. A 5xx answer may be tried again, and any other error
 * status fails at once.
 */
const sendSessionRead = Effect.fn("www.auth.session.send")(function* (
  url: URL,
  headers: Headers
) {
  const fetch = yield* FetchHttpClient.Fetch;
  const response = yield* Effect.tryPromise({
    catch: (cause) =>
      classifyNetworkFailure(
        cause,
        new SessionUnavailable({ reason: "fetch" })
      ),
    try: () => fetch(url, { headers, redirect: "manual" }),
  });
  const text = yield* Effect.tryPromise({
    catch: (cause) =>
      classifyNetworkFailure(
        cause,
        new SessionUnavailable({ reason: "fetch" })
      ),
    try: () => response.text(),
  });
  if (response.status >= 500) {
    return yield* new RetryableNetworkAttempt({
      failure: new SessionUnavailable({
        reason: "status",
        status: response.status,
      }),
    });
  }
  if (response.status >= 400) {
    return yield* new SessionUnavailable({
      reason: "status",
      status: response.status,
    });
  }
  return SessionAnswer.make({
    setCookies: response.headers.getSetCookie(),
    text,
  });
});

/** Reads the session route under the shared deadline and retry schedule. */
const readSessionAnswer = (url: URL, headers: Headers) =>
  retryNetworkAttempt(
    sendSessionRead(url, headers),
    new SessionUnavailable({ reason: "deadline" })
  );

/**
 * The value of the last Set-Cookie of one name, or none when the answer sets no
 * value for it. A cleared cookie has an empty value, so it counts as none.
 */
function readSetCookieValue(
  setCookies: readonly string[],
  name: string
): Option.Option<string> {
  const values = Arr.filterMap(setCookies, (setCookie) => {
    const [pair] = setCookie.split(";");
    const [cookieName, ...value] = pair.split("=");
    return cookieName.trim() === name
      ? Result.succeed(Arr.join(value, "=").trim())
      : Result.failVoid;
  });
  return Arr.last(values).pipe(Option.filter((value) => value !== ""));
}

/**
 * The Convex token of a signed-in answer: its JWT cookie, or else one read of the
 * token route. Undefined when the token route answers 401, which means that the
 * session ended.
 */
const readConvexToken = Effect.fn("www.auth.session.token")(function* (
  answer: SessionAnswer,
  site: URL,
  request: Request
) {
  const jwt = readSetCookieValue(answer.setCookies, CONVEX_JWT_COOKIE);
  if (Option.isSome(jwt)) {
    return jwt.value;
  }
  return yield* readSessionToken(site.href, request.headers).pipe(
    Effect.mapError(
      (error) =>
        new SessionUnavailable(
          error.status === undefined
            ? { reason: error.reason }
            : { reason: error.reason, status: error.status }
        )
    )
  );
});

/**
 * Reads the session of one request. A request without a session cookie is a
 * visitor, and it makes no network call. Otherwise one call to the Convex site
 * reads the session. Every Set-Cookie value of that answer reaches the browser,
 * including a cleared session cookie. Its `convex_jwt` value is the Convex token,
 * and the token route is read only when that cookie is missing. A failure is
 * `SessionUnavailable`, so an outage never looks like a signed-out visitor.
 */
export const readRequestSession = Effect.fn("www.auth.session.read")(function* (
  request: Request
) {
  if (getSessionCookie(request.headers) === null) {
    return signedOut([]);
  }
  const siteUrl = yield* CONVEX_SITE_URL;
  const site = new URL(siteUrl);
  const answer = yield* readSessionAnswer(
    new URL(SESSION_PATH, site),
    siteHeaders(request, site)
  );
  const body = yield* Schema.decodeEffect(SessionJson)(answer.text).pipe(
    Effect.mapError(() => new SessionUnavailable({ reason: "body" }))
  );
  if (body === null) {
    return signedOut(answer.setCookies);
  }
  const convexToken = yield* readConvexToken(answer, site, request);
  if (convexToken === undefined) {
    return signedOut(answer.setCookies);
  }
  return RequestSession.make({
    client: ClientSession.cases.SignedIn.make({
      name: body.user.name,
      sessionId: body.session.id,
      userId: body.user.id,
    }),
    convexToken: Option.some(convexToken),
    setCookies: [...answer.setCookies],
  });
});

/**
 * The session of one request, read at most once. The first reader that awaits
 * the memo runs the read, and every later reader gets the same answer. Create one
 * memo per request, in the request's own context: a memo kept at module scope
 * would hand one visitor's session to another request.
 */
export const createRequestSession = (request: Request) =>
  Effect.cached(readRequestSession(request));
