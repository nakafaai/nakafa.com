import "@tanstack/react-start/server-only";
import { convexBetterAuthReactStart } from "@convex-dev/better-auth/react-start";
import { Config, Effect } from "effect";
import { createAuthProxy } from "@/lib/auth/proxy";
import { runServerEffect } from "@/lib/server/fn";

/** The Convex deployment and its site, read at runtime by the server. */
const CONVEX_SITES = Effect.all({
  convexSiteUrl: Config.NonEmptyString("VITE_CONVEX_SITE_URL"),
  convexUrl: Config.NonEmptyString("VITE_CONVEX_URL"),
});

/**
 * Forwards one Better Auth request to the Convex site through the proxy, which
 * keeps the deadline, the retry rule and the signed-out answer. The Better Auth
 * helper keeps every Set-Cookie value and never follows a redirect, so a
 * sign-in redirect and its cookies reach the browser unchanged.
 */
export async function forwardAuthRequest(request: Request): Promise<Response> {
  const sites = await runServerEffect(CONVEX_SITES);
  const { handler } = {
    handler: convexBetterAuthReactStart(sites).handler,
  };
  const proxy = createAuthProxy({ GET: handler, POST: handler });
  return request.method === "POST" ? proxy.POST(request) : proxy.GET(request);
}
