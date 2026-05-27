import { convexBetterAuthNextJs } from "@convex-dev/better-auth/nextjs";
import { JWT_COOKIE_NAME } from "@convex-dev/better-auth/plugins";
import { getSessionCookie } from "better-auth/cookies";
import { headers } from "next/headers";
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

export const {
  handler,
  preloadAuthQuery,
  isAuthenticated,
  fetchAuthQuery,
  fetchAuthMutation,
  fetchAuthAction,
} = authServer;

/** Detects whether the request can refresh or reuse a Better Auth Convex JWT. */
function hasAuthSession(requestHeaders: Headers) {
  return Boolean(
    getSessionCookie(requestHeaders, { cookieName: JWT_COOKIE_NAME }) ??
      getSessionCookie(requestHeaders)
  );
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
export const getToken = cache(async function getToken() {
  const requestHeaders = new Headers(await headers());

  if (!hasAuthSession(requestHeaders)) {
    return;
  }

  return authServer.getToken();
});
