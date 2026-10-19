import { ConvexReactClient } from "convex/react";
import type { ClientSession } from "@/lib/auth/visitor";

/** The one browser client of this page, created on first use. */
let shared: ConvexReactClient | undefined;

/**
 * Returns the browser's Convex client. Constructing it opens no socket: the first
 * subscription or `setAuth` opens one, so a visitor who reads only public pages
 * opens none.
 */
export function readConvexClient(convexUrl: string): ConvexReactClient {
  shared ??= new ConvexReactClient(convexUrl, { logger: false });
  return shared;
}

/**
 * Gives the client the visitor's token, and only for a signed-in visitor. A
 * signed-out visitor never reaches `setAuth`, so no authenticated socket opens.
 */
export function authenticateConvex(
  client: ConvexReactClient,
  session: ClientSession,
  fetchToken: () => Promise<string | null>
) {
  if (session._tag === "SignedOut") {
    return;
  }
  client.setAuth(fetchToken);
}
