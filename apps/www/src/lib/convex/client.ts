import { ConvexReactClient } from "convex/react";

/** The one browser client of this page, created on first use. */
let shared: ConvexReactClient | undefined;

/**
 * How long before a session's Convex token expires the client asks for the next
 * one, in seconds. The token lives fifteen minutes. Chrome wakes the timers of a
 * tab hidden for five minutes only once a minute, so the client's own ten seconds
 * let the token expire first: Convex then runs the page's queries without an
 * identity, each one refuses with SessionRequired, and only then does the late
 * refresh arrive. Two minutes leave a minute after the latest wake-up, which is
 * also room to ask again when a token request fails.
 * https://developer.chrome.com/blog/timer-throttling-in-chrome-88
 */
const TOKEN_REFRESH_LEEWAY_SECONDS = 120;

/**
 * Returns the browser's Convex client. Constructing it opens no socket: the first
 * subscription or `setAuth` opens one, so a visitor who reads only public pages
 * opens none. Every island of a page shares this client, so a page holds one socket.
 *
 * The client holds every query, mutation and action until it has sent the
 * session's token, or learned that there is none (`releaseConvexAuth`). The page
 * hands it credentials once the session's module loads, after hydration, and a
 * press in that moment would otherwise reach the server signed out.
 */
export function readConvexClient(convexUrl: string): ConvexReactClient {
  shared ??= new ConvexReactClient(convexUrl, {
    authRefreshTokenLeewaySeconds: TOKEN_REFRESH_LEEWAY_SECONDS,
    expectAuth: true,
    initialAuthTokenReuse: true,
    logger: false,
  });
  return shared;
}
