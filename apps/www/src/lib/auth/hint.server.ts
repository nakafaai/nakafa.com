import { getRequest } from "@tanstack/react-start/server";
import { Config, Effect, Option, Schema } from "effect";
import { SessionJson } from "@/lib/auth/answer";
import {
  hasSignedInHint,
  hintCookieFor,
  hintScopeFor,
  isHintCurrent,
} from "@/lib/auth/hint";
import { ClientSession } from "@/lib/auth/visitor";

/** The site's own address, whose host the hint cookie names. */
const SITE_URL = Config.String("SITE_URL");

/**
 * Whether this request's cookies carry the signed-in hint. The browser sends the
 * hint with every page, so the server knows the visitor's state before the first
 * HTML, without asking the auth service.
 */
export function readRequestSignedInHint(): boolean {
  return Option.match(
    Option.fromNullishOr(getRequest().headers.get("cookie")),
    {
      onNone: () => false,
      onSome: hasSignedInHint,
    }
  );
}

/**
 * Gives the answer of a session read the hint cookie that the answer says, when the
 * request's hint says otherwise. Better Auth's own routes skip the request
 * middleware that keeps the hint (`requestSession` in `start.ts`), so the session
 * read that every page makes keeps it instead: a signed-in answer sets it and a
 * signed-out one clears it. An answer that is no session read passes unchanged.
 */
export const withSessionHint = Effect.fn("www.auth.hint.sessionRead")(
  function* (request: Request, response: Response) {
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
    const site = yield* SITE_URL;
    const headers = new Headers(response.headers);
    headers.append(
      "set-cookie",
      hintCookieFor(session, hintScopeFor(new URL(site)))
    );
    return new Response(response.body, {
      headers,
      status: response.status,
      statusText: response.statusText,
    });
  }
);
