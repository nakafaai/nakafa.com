import type { Effect } from "effect";
import { hasSignedInHint } from "@/lib/auth/hint";
import {
  readBrowserSessionToken,
  type SessionTokenUnavailable,
} from "@/lib/auth/token";

/**
 * What a page in the browser knows of its session before it reads one: whether
 * the signed-in hint of its cookie says it holds one, and the read of the
 * session's Convex token from the token route of its own origin, which answers
 * `undefined` for a visitor. It holds an effect, which no Schema describes as
 * data, so it is a plain type.
 */
export type BrowserPresence = {
  readonly signedIn: boolean;
  readonly token: Effect.Effect<string | undefined, SessionTokenUnavailable>;
};

/**
 * The browser's one reader of sign-in. It takes the document's cookie and the
 * page's origin, so the boundary that calls it (a route's `beforeLoad`, an event)
 * reads `document` and `window` once, and every decision it hands the presence to
 * is a function of its arguments. The server reads the session itself
 * (`sessionFn`), or the session cookie of the request (`readSessionCookie`).
 */
export function readBrowserPresence(
  cookie: string,
  origin: string
): BrowserPresence {
  return {
    signedIn: hasSignedInHint(cookie),
    token: readBrowserSessionToken(origin),
  };
}
