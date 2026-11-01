import { parseSetCookieHeader } from "better-auth/cookies";
import { Array as Arr, Config, Effect, Option, pipe, Schema } from "effect";
import { SessionJson } from "@/lib/auth/answer";
import { isSessionCookieName } from "@/lib/auth/cookie.server";
import {
  expiredHintCookie,
  hintCookieFor,
  hintScopeFor,
  isHintCurrent,
  signedInHintCookie,
} from "@/lib/auth/hint";
import { SESSION_PATH } from "@/lib/auth/session";
import { ClientSession } from "@/lib/auth/visitor";

/** The site's own address, whose host the hint cookie names. */
const SITE_URL = Config.String("SITE_URL");

/** Whether an answer signs the browser in or out, by the session cookie it writes. */
function readSessionWrite(response: Response) {
  return pipe(
    response.headers.getSetCookie(),
    Arr.flatMap((cookie) => Arr.fromIterable(parseSetCookieHeader(cookie))),
    Arr.findLast(([name]) => isSessionCookieName(name)),
    Option.map(([, { value }]) => value !== "")
  );
}

/** The answer with one more cookie for the browser. */
function withCookie(response: Response, cookie: string) {
  const headers = new Headers(response.headers);
  headers.append("set-cookie", cookie);
  return new Response(response.body, {
    headers,
    status: response.status,
    statusText: response.statusText,
  });
}

/**
 * Gives an answer of Better Auth the hint cookie that it says. Better Auth's own
 * routes skip the request middleware that keeps the hint (`requestSession` in
 * `start.ts`), and a sign-in ends on a static page that no middleware serves, so
 * these answers keep it instead. An answer that writes the session cookie, as a
 * sign-in, a sign-out and a session refresh do, sets the hint with it or clears it,
 * so the next document is right from its first paint and a hint lives as long as
 * the session it marks. The session read that every page makes corrects a hint
 * that says otherwise. Any other answer passes unchanged.
 */
export const withSessionHint = Effect.fn("www.auth.hint.answer")(function* (
  request: Request,
  response: Response
) {
  const write = readSessionWrite(response);
  if (Option.isSome(write)) {
    const scope = hintScopeFor(new URL(yield* SITE_URL));
    return withCookie(
      response,
      write.value ? signedInHintCookie(scope) : expiredHintCookie(scope)
    );
  }
  if (new URL(request.url).pathname !== SESSION_PATH) {
    return response;
  }
  const text = yield* Effect.promise(() => response.clone().text());
  const body = Schema.decodeOption(SessionJson)(text);
  if (Option.isNone(body)) {
    return response;
  }
  const session =
    body.value === null
      ? ClientSession.cases.SignedOut.make({})
      : ClientSession.cases.SignedIn.make({
          name: body.value.user.name,
          sessionId: body.value.session.id,
          userId: body.value.user.id,
        });
  if (isHintCurrent(session, request.headers)) {
    return response;
  }
  return withCookie(
    response,
    hintCookieFor(session, hintScopeFor(new URL(yield* SITE_URL)))
  );
});
