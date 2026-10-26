import { ConvexReactClient } from "convex/react";

/** The one browser client of this page, created on first use. */
let shared: ConvexReactClient | undefined;

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
    expectAuth: true,
    initialAuthTokenReuse: true,
    logger: false,
  });
  return shared;
}
