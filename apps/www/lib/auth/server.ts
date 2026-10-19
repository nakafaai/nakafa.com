import "@tanstack/react-start/server-only";

import { convexBetterAuthReactStart } from "@convex-dev/better-auth/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { Effect } from "effect";
import { env } from "@/env";
import { readSessionToken } from "@/lib/auth/token";

const authServer = convexBetterAuthReactStart({
  convexUrl: env.VITE_CONVEX_URL,
  convexSiteUrl: env.VITE_CONVEX_SITE_URL,
});

/** Answers every Better Auth request of the auth route, with its cookies kept. */
export const { handler } = authServer;

/**
 * Returns the current request's Better Auth token, or `undefined` for a visitor
 * without a session. Any other failure rejects with `SessionTokenUnavailable`,
 * so the page's error boundary handles an outage instead of showing a
 * signed-out view. It reads the request that the server is handling, so it runs
 * in a loader or a server function.
 */
export function getToken() {
  return Effect.runPromise(
    readSessionToken(env.VITE_CONVEX_SITE_URL, getRequest().headers)
  );
}
