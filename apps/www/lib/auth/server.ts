import { convexBetterAuthNextJs } from "@convex-dev/better-auth/nextjs";
import { cache } from "react";
import { env } from "@/env";
import { isAuthError } from "@/lib/auth/utils";

const authServer = convexBetterAuthNextJs({
  convexUrl: env.NEXT_PUBLIC_CONVEX_URL,
  convexSiteUrl: env.NEXT_PUBLIC_CONVEX_SITE_URL,
  jwtCache: {
    enabled: true,
    isAuthError,
  },
});

/** Error thrown when a server action is called without an authenticated request. */
export class AuthenticationRequiredError extends Error {
  constructor() {
    super("Authentication required");
    this.name = "AuthenticationRequiredError";
  }
}

export const {
  handler,
  preloadAuthQuery,
  isAuthenticated,
  fetchAuthQuery,
  fetchAuthMutation,
  fetchAuthAction,
} = authServer;

/**
 * Ensures server actions check auth before running mutations or actions.
 *
 * React Doctor's server-action rule expects an auth guard at the top of every
 * exported server action, and Convex Better Auth exposes `isAuthenticated()` for
 * the current Next.js request.
 *
 * @see https://www.react.doctor/docs/getting-started/how-to-fix-issues
 * @see https://labs.convex.dev/better-auth/framework-guides/next#ssr-with-server-components
 */
export async function requireAuth() {
  if (await isAuthenticated()) {
    return;
  }

  throw new AuthenticationRequiredError();
}

/**
 * Returns the current request's Better Auth token.
 *
 * `cache()` keeps repeated token reads within the same request consistent for
 * server layouts and pages that both need auth-aware Convex work.
 *
 * @see https://react.dev/reference/react/cache
 * @see https://labs.convex.dev/better-auth/framework-guides/next#ssr-with-server-components
 */
export const getToken = cache(authServer.getToken);
