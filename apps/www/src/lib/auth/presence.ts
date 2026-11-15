import { Effect } from "effect";
import { hasSignedInHint } from "@/lib/auth/hint";
import type { SessionTokenUnavailable } from "@/lib/auth/token";

/**
 * The browser's one reader of sign-in. It takes the document's cookie and the
 * page's origin, so the boundary that calls it (a route's `beforeLoad`, an event)
 * reads `document` and `window` once, and every decision it hands the presence to
 * is a function of its arguments. It answers whether the signed-in hint of the
 * cookie says a session exists, and the read of the session's Convex token from
 * the token route of its own origin, which answers `undefined` for a visitor.
 * The server reads the session itself
 * (`sessionFn`), or the session cookie of the request (`readSessionCookie`).
 *
 * A route's `beforeLoad` calls this, and the route tree is in the first JavaScript
 * of every page, so the token reader and Effect's HTTP client load only when the
 * token is read.
 */
export function readBrowserPresence(
  cookie: string,
  origin: string
): {
  readonly signedIn: boolean;
  readonly token: Effect.Effect<string | undefined, SessionTokenUnavailable>;
} {
  return {
    signedIn: hasSignedInHint(cookie),
    token: Effect.promise(() => import("@/lib/auth/token")).pipe(
      Effect.flatMap(({ readBrowserSessionToken }) =>
        readBrowserSessionToken(origin)
      )
    ),
  };
}

/** What a page in the browser knows of its session before it reads one, as `readBrowserPresence` answers it. */
export type BrowserPresence = ReturnType<typeof readBrowserPresence>;
