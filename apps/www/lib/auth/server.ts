import { convexBetterAuthNextJs } from "@convex-dev/better-auth/nextjs";
import { env } from "@/env";

const authServer = convexBetterAuthNextJs({
  convexUrl: env.NEXT_PUBLIC_CONVEX_URL,
  convexSiteUrl: env.NEXT_PUBLIC_CONVEX_SITE_URL,
});

export const { handler, preloadAuthQuery, fetchAuthQuery } = authServer;

/**
 * Returns the current request's Better Auth token.
 *
 * Better Auth reads `headers()` before decoding its JWT clock, so Next.js has
 * already entered request time without an extra `io()` boundary. The installed
 * integration already memoizes this read per request, so no local cache layer
 * is needed.
 *
 * @see https://github.com/get-convex/better-auth/blob/1977ce5737959f0ba61895211b04a532427bcfa9/src/nextjs/index.ts#L94-L105
 * @see https://nextjs.org/docs/app/api-reference/functions/headers
 * @see https://react.dev/reference/react/cache
 * @see https://labs.convex.dev/better-auth/framework-guides/next#ssr-with-server-components
 */
export const getToken = () => authServer.getToken();
