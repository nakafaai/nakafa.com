import { convexBetterAuthNextJs } from "@convex-dev/better-auth/nextjs";
import { Effect } from "effect";
import { headers } from "next/headers";
import { cache } from "react";
import { env } from "@/env";
import { readSessionToken } from "@/lib/auth/token";

const authServer = convexBetterAuthNextJs({
  convexUrl: env.NEXT_PUBLIC_CONVEX_URL,
  convexSiteUrl: env.NEXT_PUBLIC_CONVEX_SITE_URL,
});

export const { handler } = authServer;

/**
 * Returns the current request's Better Auth token, or `undefined` for a visitor
 * without a session. Any other failure rejects with `SessionTokenUnavailable`,
 * so the page's error boundary handles an outage instead of showing a
 * signed-out view.
 *
 * `headers()` is awaited before the Effect runtime starts, so Next.js has
 * already entered request time. React's `cache` shares the promise for the rest
 * of the request, so one request reads the token once.
 *
 * @see https://nextjs.org/docs/app/api-reference/functions/headers
 * @see https://react.dev/reference/react/cache
 */
export const getToken = cache(async () => {
  const requestHeaders = await headers();
  return Effect.runPromise(
    readSessionToken(env.NEXT_PUBLIC_CONVEX_SITE_URL, requestHeaders)
  );
});
