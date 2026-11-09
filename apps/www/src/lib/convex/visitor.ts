import { ConvexReactClient } from "convex/react";

/** The visitor's read-only client of this page, created on first use. */
let shared: ConvexReactClient | undefined;

/**
 * Returns the client a visitor reads public Convex data with, such as a page's comments. A visitor's page
 * holds no session and no page client (`readConvexClient`), so this client sends no token and waits for none:
 * every query runs at once as a signed-out read. Only a part that a visitor reads live loads this module, once
 * it comes near the viewport, so a page that a visitor never scrolls to that part opens no socket. It never
 * writes, because every write of such a part asks a visitor to sign in first.
 */
export function readVisitorClient(convexUrl: string): ConvexReactClient {
  shared ??= new ConvexReactClient(convexUrl, {
    logger: false,
    unsavedChangesWarning: false,
  });
  return shared;
}
