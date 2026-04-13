/**
 * Same-origin PostHog proxy path.
 *
 * PostHog only documents the pattern here: use a neutral, app-specific path
 * instead of obvious analytics words. Nakafa uses `/_nakafa`.
 *
 * References:
 * https://posthog.com/docs/libraries/next-js
 * https://posthog.com/docs/advanced/proxy/nextjs
 * https://posthog.com/docs/advanced/proxy/vercel
 */
export const POSTHOG_PROXY_PATH = "/_nakafa";

/**
 * Return whether one request pathname targets the same-origin PostHog proxy.
 *
 * References:
 * https://nextjs.org/docs/app/api-reference/file-conventions/proxy
 */
export function isPostHogProxyPathname(pathname: string) {
  return (
    pathname === POSTHOG_PROXY_PATH ||
    pathname.startsWith(`${POSTHOG_PROXY_PATH}/`)
  );
}

/**
 * Build the rewrite rules required by PostHog's Next.js reverse-proxy docs.
 *
 * `apiHost` is Nakafa's managed PostHog proxy origin (`t.nakafa.com`). Vercel
 * fetches that upstream server-side while the browser only sees `nakafa.com`.
 *
 * References:
 * https://posthog.com/docs/advanced/proxy/managed-reverse-proxy
 * https://posthog.com/docs/advanced/proxy/nextjs
 * https://posthog.com/docs/advanced/proxy/vercel
 */
export function createPostHogProxyRewrites(apiHost: string) {
  const postHogOrigin = new URL(apiHost).origin;

  return [
    {
      source: `${POSTHOG_PROXY_PATH}/static/:path*`,
      destination: `${postHogOrigin}/static/:path*`,
    },
    {
      source: `${POSTHOG_PROXY_PATH}/array/:path*`,
      destination: `${postHogOrigin}/array/:path*`,
    },
    {
      source: `${POSTHOG_PROXY_PATH}/:path*`,
      destination: `${postHogOrigin}/:path*`,
    },
  ];
}
