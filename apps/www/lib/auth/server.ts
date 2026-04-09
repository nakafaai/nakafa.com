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

export const {
  handler,
  preloadAuthQuery,
  isAuthenticated,
  fetchAuthQuery,
  fetchAuthMutation,
  fetchAuthAction,
} = authServer;

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
