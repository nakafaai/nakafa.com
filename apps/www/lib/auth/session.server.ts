import "@tanstack/react-start/server-only";
import { FetchClient } from "@repo/utilities/http/client";
import { getSessionCookie } from "better-auth/cookies";
import { Config, Effect, Option, Record as Rec, Schema } from "effect";
import {
  Cookies,
  HttpClient,
  HttpClientRequest,
  HttpClientResponse,
} from "effect/http";
import { ClientSession } from "@/lib/auth/visitor";

/** The session of a request could not be read: a network failure, an error status or an unreadable body. */
export class SessionUnavailable extends Schema.TaggedError<SessionUnavailable>()(
  "SessionUnavailable",
  {
    reason: Schema.Literals(["body", "fetch", "status"]),
    status: Schema.optionalKey(Schema.Int),
  }
) {}

/** The session of one request on the server: what a page may see, the Convex token, and the cookies to send back. */
const RequestSession = Schema.Struct({
  client: ClientSession,
  convexToken: Schema.NullOr(Schema.String),
  setCookies: Schema.Array(Schema.String),
});

/** The Better Auth routes of the Convex site that answer for one request's cookies. */
const SESSION_PATH = "/api/auth/get-session";
const TOKEN_PATH = "/api/auth/convex/token";

/** The cookie that Better Auth's Convex plugin writes beside the session. */
const CONVEX_JWT_COOKIE = "convex_jwt";

const SessionBody = Schema.NullOr(
  Schema.Struct({
    session: Schema.Struct({ id: Schema.String }),
    user: Schema.Struct({ id: Schema.String, name: Schema.String }),
  })
);

const TokenBody = Schema.Struct({ token: Schema.String });

/** The address of the Convex site, read at runtime by the server. */
const CONVEX_SITE_URL = Config.NonEmptyString("VITE_CONVEX_SITE_URL");

/** The Convex JWT that the answer set, or none. */
function readConvexJwt(cookies: Cookies.Cookies) {
  return Option.map(
    Rec.get(cookies.cookies, CONVEX_JWT_COOKIE),
    (cookie) => cookie.value
  );
}

/** Sends one read to the Convex site with the request's own cookies, and reads its answer. */
const sendRead = Effect.fn("www.auth.session.send")(function* (
  url: URL,
  headers: Headers
) {
  const client = (yield* HttpClient.HttpClient).pipe(HttpClient.withScope);
  const response = yield* client
    .execute(HttpClientRequest.get(url, { headers }))
    .pipe(Effect.mapError(() => new SessionUnavailable({ reason: "fetch" })));
  if (response.status >= 400) {
    return yield* new SessionUnavailable({
      reason: "status",
      status: response.status,
    });
  }
  return response;
}, Effect.scoped);

/** The Convex site with the path of one Better Auth route. */
function siteRoute(site: string, path: string) {
  return new URL(path, site);
}

/** The Convex token from the token route, read from its JSON answer. */
const readTokenRoute = Effect.fn("www.auth.session.token")(function* (
  site: string,
  headers: Headers
) {
  const answer = yield* sendRead(siteRoute(site, TOKEN_PATH), headers);
  const decoded = yield* HttpClientResponse.schemaBodyJson(TokenBody)(
    answer
  ).pipe(Effect.mapError(() => new SessionUnavailable({ reason: "body" })));
  return decoded.token;
});

/**
 * Reads the session of one request. A request without a session cookie is a
 * visitor, and it makes no network call. Otherwise one call to the Convex site
 * reads the session, and the JWT cookie of that answer is the Convex token. A
 * session without a JWT cookie reads the token route. A failure is
 * `SessionUnavailable`, so an outage never looks like a signed-out visitor.
 */
export const readRequestSession = Effect.fn("www.auth.session.read")(function* (
  headers: Headers
) {
  const signedOut = RequestSession.make({
    client: ClientSession.cases.SignedOut.make({}),
    convexToken: null,
    setCookies: [],
  });
  if (getSessionCookie(headers) === null) {
    return signedOut;
  }
  const site = yield* CONVEX_SITE_URL;
  const answer = yield* sendRead(siteRoute(site, SESSION_PATH), headers);
  const setCookies = Cookies.toSetCookieHeaders(answer.cookies);
  const body = yield* HttpClientResponse.schemaBodyJson(SessionBody)(
    answer
  ).pipe(Effect.mapError(() => new SessionUnavailable({ reason: "body" })));
  if (body === null) {
    return signedOut;
  }
  const convexToken = yield* Option.match(readConvexJwt(answer.cookies), {
    onNone: () => readTokenRoute(site, headers),
    onSome: (token) => Effect.succeed(token),
  });
  return RequestSession.make({
    client: ClientSession.cases.SignedIn.make({
      name: body.user.name,
      sessionId: body.session.id,
      userId: body.user.id,
    }),
    convexToken,
    setCookies,
  });
}, Effect.provide(FetchClient));
