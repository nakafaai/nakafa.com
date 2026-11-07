import { CONVEX_TOKEN_OPTIONS } from "@repo/backend/confect/auth/browser";
import { GOING_RELOAD, readPageGoing } from "@repo/design-system/lib/lazy";
import { ConvexReactClient } from "convex/react";

/** The one browser client of this page, created on first use. */
let shared: ConvexReactClient | undefined;

/**
 * Asks before the page goes while a request has no answer yet, as Convex's own
 * warning does, except when the page reloads for a chunk of an earlier deploy.
 * That reload is the only way the page reaches the current deploy, and a prompt
 * that stopped it would leave the page on chunks that are gone.
 */
export function askBeforeLosingRequests(
  client: Pick<ConvexReactClient, "connectionState">,
  event: Pick<BeforeUnloadEvent, "preventDefault">
) {
  if (
    client.connectionState().hasInflightRequests &&
    readPageGoing() !== GOING_RELOAD
  ) {
    event.preventDefault();
  }
}

/**
 * Returns the browser's Convex client. Constructing it opens no socket: the first
 * subscription or `setAuth` opens one, so a visitor who reads only public pages
 * opens none. Every island of a page shares this client, so a page holds one socket.
 *
 * The client holds every query, mutation and action until it has sent the
 * session's token, or learned that there is none (`releaseConvexAuth`). The page
 * hands it credentials once the session's module loads, after hydration, and a
 * press in that moment would otherwise reach the server signed out.
 *
 * Its warning before the page goes with a request in flight is
 * `askBeforeLosingRequests`, in place of Convex's own.
 */
export function readConvexClient(convexUrl: string): ConvexReactClient {
  if (shared !== undefined) {
    return shared;
  }
  const client = new ConvexReactClient(convexUrl, {
    ...CONVEX_TOKEN_OPTIONS,
    expectAuth: true,
    logger: false,
    unsavedChangesWarning: false,
  });
  if (typeof window !== "undefined") {
    window.addEventListener("beforeunload", (event) =>
      askBeforeLosingRequests(client, event)
    );
  }
  shared = client;
  return client;
}
