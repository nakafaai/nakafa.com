import { Array as Arr, Option, Schema } from "effect";
import { readSessionCookie } from "@/lib/auth/cookie.server";
import { SESSION_PATH, TOKEN_PATH } from "@/lib/auth/session";

/** The Better Auth session of the session route, or null for a visitor. */
export const SessionJson = Schema.fromJsonString(
  Schema.NullOr(
    Schema.Struct({
      session: Schema.Struct({ id: Schema.String }),
      user: Schema.Struct({ id: Schema.String, name: Schema.String }),
    })
  )
);

/** Whether a request sends nothing that could prove a session: no session cookie and no bearer token. */
function sendsNoCredentials(request: Request) {
  return (
    readSessionCookie(request) === null && !request.headers.has("authorization")
  );
}

/** The headers of an answer about no session, which no cache may keep. */
function noStoreHeaders() {
  return new Headers({ "Cache-Control": "no-store", Pragma: "no-cache" });
}

/**
 * The answer to a token read that names no live session: no token, with the
 * cookies Better Auth's own answer cleared. Better Auth answers such a read 401,
 * and the browser logs every 401 it fetches as an error, though a page that
 * remembered a session that has since ended asks for its token as it loads. The
 * page's token reader takes a missing token as it takes the 401, and hands
 * Convex `null`, which Convex reads as signed out.
 */
function answerNoToken(cookies: readonly string[]) {
  const headers = noStoreHeaders();
  Arr.forEach(cookies, (cookie) => headers.append("set-cookie", cookie));
  return Response.json({ token: null }, { headers });
}

/**
 * The answer the relay gives a read itself, without Better Auth, for a request
 * that sends no credentials: the session read gets the `null` Better Auth gives
 * it, and the token read gets no token.
 *
 * Better Auth answers such a session read with `null` before it reads a table,
 * so Convex has nothing to add. Without this answer each read is still one HTTP
 * action on the Convex site: a function call and its action compute, though no
 * database I/O. Every page load and every return to the tab makes this read,
 * signed in or not, and most visitors are not. The browser cannot skip the
 * request itself, because the session cookie is HttpOnly and no script can see
 * that it is missing; only the server can. Better Auth's own answer also clears
 * a Convex JWT cookie, which nothing here reads, because the Better Auth helper
 * that does is used without its JWT cache.
 */
export function answerWithoutAuth(request: Request): Option.Option<Response> {
  if (!sendsNoCredentials(request)) {
    return Option.none();
  }
  const { pathname } = new URL(request.url);
  if (pathname === SESSION_PATH) {
    return Option.some(Response.json(null, { headers: noStoreHeaders() }));
  }
  if (pathname === TOKEN_PATH) {
    return Option.some(answerNoToken([]));
  }
  return Option.none();
}

/**
 * Better Auth's answer to a read as the browser gets it: a token read whose
 * session has ended gets no token in place of the 401, and every other answer
 * passes as it is.
 */
export function answerFromAuth(request: Request, response: Response) {
  return new URL(request.url).pathname === TOKEN_PATH && response.status === 401
    ? answerNoToken(response.headers.getSetCookie())
    : response;
}
