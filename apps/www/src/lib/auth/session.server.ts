import {
  decodeAccessToken,
  httpCookies,
  type RefreshSessionFn,
  ServerAuthSession,
} from "@convex-dev/auth/ssr";
import { siteUrlKeys } from "@repo/site/keys";
import {
  appendResponseHeader,
  getRequest,
  setResponseHeader,
} from "@tanstack/react-start/server";
import { ConvexHttpClient } from "convex/browser";
import { type FunctionReference, makeFunctionReference } from "convex/server";
import { Array as Arr, Effect, Option, Schema } from "effect";
import {
  hasSessionCookie,
  inboundCookieHeader,
  outboundSetCookie,
  siteAuthCookies,
} from "@/lib/auth/cookies";
import { ClientSession } from "@/lib/auth/visitor";
import { serverHandler } from "@/lib/server/fn";
import { CONVEX_URL } from "@/lib/server/runtime";

/** The session of one request could not be read: Convex did not answer, or answered what no session reads as. */
export class SessionUnavailable extends Schema.TaggedError<
  SessionUnavailable,
  { readonly brand: unique symbol }
>()("SessionUnavailable", {
  reason: Schema.Literals(["body", "fetch"]),
}) {}

/** The session of one request on the server: what a page may see, the access token when there is one, and every Set-Cookie value to send back. */
const RequestSession = Schema.Struct({
  client: ClientSession,
  convexToken: Schema.Option(Schema.String),
  setCookies: Schema.Array(Schema.String),
});

/** The signed-in account, as `auth/queries:getCurrentUser` answers it. */
const CurrentAccount = Schema.NullOr(
  Schema.Struct({
    appUser: Schema.Struct({ _id: Schema.String, name: Schema.String }),
  })
);

/** Convex Auth's refresh, which the server calls with the refresh cookie when the access token is due. */
const refreshSession: RefreshSessionFn = makeFunctionReference(
  "auth/core:refreshSession"
);

/** The signed-in account, read with the session's own access token. */
const currentUser: FunctionReference<"query"> = makeFunctionReference(
  "auth/queries:getCurrentUser"
);

/** The session of a visitor, with the Set-Cookie values that cleared an ended one. */
function signedOut(setCookies: readonly string[]) {
  return RequestSession.make({
    client: ClientSession.cases.SignedOut.make({}),
    convexToken: Option.none(),
    setCookies: [...setCookies],
  });
}

/**
 * Reads the session of one request. A request without a refresh cookie is a
 * visitor and makes no network call. Otherwise Convex Auth's server session
 * takes the access token from its cookie, or refreshes it when it is due, and
 * one query with that token says whose session it is; a session that ended
 * reads as a visitor. Every cookie the refresh wrote reaches the browser. A
 * failure is `SessionUnavailable`, so an outage never looks like a signed-out
 * visitor.
 * https://docs.convex.dev/auth/convex-auth/ssr-nextjs/setup
 */
export const readRequestSession = Effect.fn("www.auth.session.read")(function* (
  request: Request
) {
  const site = new URL(siteUrlKeys().SITE_URL);
  const cookie = request.headers.get("cookie") ?? "";
  if (!hasSessionCookie(request, site)) {
    return signedOut([]);
  }
  const { options, prefix } = siteAuthCookies(site);
  const cookies = httpCookies(
    new Request(request.url, {
      headers: { cookie: inboundCookieHeader(cookie, prefix) },
    })
  );
  const client = new ConvexHttpClient(yield* CONVEX_URL);
  const session = new ServerAuthSession({
    cookieOptions: options,
    cookies,
    refreshSession: (refreshToken) =>
      client.mutation(refreshSession, { refreshToken }),
  });
  const token = yield* Effect.tryPromise({
    catch: () => new SessionUnavailable({ reason: "fetch" }),
    try: () => session.getToken(),
  });
  const written = new Headers();
  cookies.applyTo(written);
  const setCookies = Arr.map(written.getSetCookie(), (value) =>
    outboundSetCookie(value, prefix)
  );
  if (token === null) {
    return signedOut(setCookies);
  }
  const sessionId = decodeAccessToken(token).sub;
  if (sessionId === null) {
    return yield* new SessionUnavailable({ reason: "body" });
  }
  client.setAuth(token);
  const answer = yield* Effect.tryPromise({
    catch: () => new SessionUnavailable({ reason: "fetch" }),
    try: () => client.query(currentUser, {}),
  });
  const account = yield* Schema.decodeUnknownEffect(CurrentAccount)(
    answer
  ).pipe(Effect.mapError(() => new SessionUnavailable({ reason: "body" })));
  if (account === null) {
    return signedOut(setCookies);
  }
  return RequestSession.make({
    client: ClientSession.cases.SignedIn.make({
      name: account.appUser.name,
      sessionId,
      userId: account.appUser._id,
    }),
    convexToken: Option.some(token),
    setCookies,
  });
});

/** The session of one request, as the type of the value read once and answered to every reader. */
type RequestSession = typeof RequestSession.Type;

/** Sends the Set-Cookie values of one session read to the browser, in their order. */
const appendSetCookies = (session: RequestSession) =>
  Effect.sync(() => {
    for (const cookie of session.setCookies) {
      appendResponseHeader("set-cookie", cookie);
    }
  });

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

/**
 * The session memo of one request. The request middleware creates it before any
 * reader runs, and every reader of the same request gets the same memo. The first
 * reader that awaits it makes the read and sends the Set-Cookie values, so a
 * refresh reaches the browser once and one document reads the session once,
 * however many readers run.
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
 * The access token of one request, read from its session memo, so a request
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
 * session memo appends the cookies that a refresh set, and no cache keeps the
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
