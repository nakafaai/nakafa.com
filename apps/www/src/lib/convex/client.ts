import { ConvexReactClient } from "convex/react";

/** The one browser client of this page, created on first use. */
let shared: ConvexReactClient | undefined;

/**
 * Returns the browser's Convex client. Constructing it opens no socket: the first
 * subscription or `setAuth` opens one, so a visitor who reads only public pages
 * opens none. Every island of a page shares this client, so a page holds one socket.
 */
export function readConvexClient(convexUrl: string): ConvexReactClient {
  shared ??= new ConvexReactClient(convexUrl, {
    initialAuthTokenReuse: true,
    logger: false,
  });
  return shared;
}
