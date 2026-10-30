import {
  classifyNetworkFailure,
  RetryableNetworkAttempt,
  retryNetworkAttempt,
} from "@repo/backend/client/network";
import {
  appendResponseHeader,
  getRequest,
  setResponseHeader,
} from "@tanstack/react-start/server";
import {
  Array as Arr,
  Clock,
  Duration,
  Effect,
  Option,
  Result,
  Schema,
  String as Str,
} from "effect";
import { Base64Url } from "effect/encoding";
import { FetchHttpClient } from "effect/http";
import { SessionJson } from "@/lib/auth/answer";
import {
  isConvexTokenCookieName,
  readConvexTokenCookie,
  readSessionCookie,
} from "@/lib/auth/cookie.server";
import { SESSION_PATH } from "@/lib/auth/session";
import { readSessionToken } from "@/lib/auth/token.server";
import { ClientSession } from "@/lib/auth/visitor";
import { serverHandler } from "@/lib/server/fn";
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

/**
 * The claims of a Convex token that name its session. Better Auth's Convex plugin
 * signs the user's fields, the session ID and the expiry, in seconds, with the
 * user ID as the subject.
 */
const TokenClaims = Schema.fromJsonString(
  Schema.Struct({
    exp: Schema.Finite,
    name: Schema.String,
    sessionId: Schema.String,
    sub: Schema.String,
  })
);

/** How long before its expiry a token is no longer used: a read that starts with it must end while Convex still accepts it. */
const TOKEN_EXPIRY_MARGIN = Duration.minutes(1);

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
 * The value of the last Set-Cookie of the Convex token, or none when the answer
 * sets no value for it. A cleared cookie has an empty value, so it counts as none.
 */
function readSetConvexToken(
  setCookies: readonly string[]
): Option.Option<string> {
  const values = Arr.filterMap(setCookies, (setCookie) => {
    const [pair] = setCookie.split(";");
    const [cookieName, ...value] = pair.split("=");
    return isConvexTokenCookieName(cookieName.trim())
      ? Result.succeed(Arr.join(value, "=").trim())
      : Result.failVoid;
  });
  return Arr.last(values).pipe(Option.filter((value) => value !== ""));
}

/**
 * The session that the request's own Convex token names, while the token holds
 * longer than the margin: the answer of `jwtCache` in the official Better Auth
 * helper. The browser sends the token cookie that the last session or token
 * read set, so a signed-in request inside the token's lifetime makes no call to
 * the Convex site. The claims are read, not verified: Convex verifies the token on
 * every read, and a forged one only shows its sender a page Convex then refuses.
 */
const readTokenSession = Effect.fn("www.auth.session.cached")(function* (
  request: Request
) {
  const token = readConvexTokenCookie(request);
  if (token === null) {
    return Option.none();
  }
  const now = yield* Clock.currentTimeMillis;
  return Arr.get(Str.split(token, "."), 1).pipe(
    Option.flatMap((payload) =>
      Result.getSuccess(Base64Url.decodeString(payload))
    ),
    Option.flatMap(Schema.decodeOption(TokenClaims)),
    Option.filter(
      (claims) =>
        claims.exp * 1000 - Duration.toMillis(TOKEN_EXPIRY_MARGIN) > now
    ),
    Option.map((claims) =>
      RequestSession.make({
        client: ClientSession.cases.SignedIn.make({
          name: claims.name,
          sessionId: claims.sessionId,
          userId: claims.sub,
        }),
        convexToken: Option.some(token),
        setCookies: [],
      })
    )
  );
});

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
  const jwt = readSetConvexToken(answer.setCookies);
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
 * visitor, and it makes no network call, and so does a request whose own Convex
 * token still holds (`readTokenSession`). Otherwise one call to the Convex site
 * reads the session. Every Set-Cookie value of that answer reaches the browser,
 * including a cleared session cookie. Its `convex_jwt` value is the Convex token,
 * and the token route is read only when that cookie is missing. A failure is
 * `SessionUnavailable`, so an outage never looks like a signed-out visitor.
 */
export const readRequestSession = Effect.fn("www.auth.session.read")(function* (
  request: Request
) {
  if (readSessionCookie(request.headers) === null) {
    return signedOut([]);
  }
  const cached = yield* readTokenSession(request);
  if (Option.isSome(cached)) {
    return cached.value;
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

/** The session of one request, as the type of the value read once and answered to every reader. */
type RequestSession = typeof RequestSession.Type;

/** Creates the memo of one request: an effect that reads the session once and answers the same value after it. */
const createSessionMemo = (request: Request) =>
  Effect.cached(readRequestSession(request).pipe(Effect.tap(appendSetCookies)));

/** The memo of one request, as `createSessionMemo` makes it. */
type RequestSessionMemo = Effect.Success<ReturnType<typeof createSessionMemo>>;

/**
 * The memo of each request, keyed by its Request object. A WeakMap lets a memo
 * leave with its request, so one visitor's session never answers another request.
 */
const sessionMemos = new WeakMap<Request, RequestSessionMemo>();

/** Sends the Set-Cookie values of one session answer to the browser, in their order. */
const appendSetCookies = (session: RequestSession) =>
  Effect.sync(() => {
    for (const cookie of session.setCookies) {
      appendResponseHeader("set-cookie", cookie);
    }
  });

/**
 * The session memo of one request. The request middleware creates it before any
 * reader runs, and every reader of the same request gets the same memo. The first
 * reader that awaits it makes the read and sends the Set-Cookie values, so a
 * sliding refresh reaches the browser once and one document reads the session
 * once, however many readers run.
 */
export const readSessionMemo = (request: Request) =>
  Effect.gen(function* () {
    const created = yield* createSessionMemo(request);
    return yield* Effect.sync(() => {
      const existing = sessionMemos.get(request);
      if (existing !== undefined) {
        return existing;
      }
      sessionMemos.set(request, created);
      return created;
    });
  });

/**
 * The Convex token of one request, read from its session memo, so a request
 * that also reads its session makes no second session call. A visitor has none.
 */
export const readRequestToken = Effect.fn("www.auth.session.requestToken")(
  function* (request: Request) {
    const memo = yield* readSessionMemo(request);
    const session = yield* memo;
    return Option.getOrUndefined(session.convexToken);
  }
);

/**
 * The visitor's session, answered to the browser without any credential. The
 * session memo appends the cookies that Better Auth set, and no cache keeps the
 * answer.
 */
export const readSessionClient = Effect.fn("www.auth.session.client")(
  function* () {
    const memo = yield* readSessionMemo(getRequest());
    const session = yield* memo;
    yield* Effect.sync(() =>
      setResponseHeader("cache-control", "private, no-store")
    );
    return session.client;
  }
);

/** The handler of the session server function, which the server wiring calls. */
export const sessionHandler = serverHandler(() => readSessionClient());
