/**
 * Same-origin path of the PostHog proxy. The browser client sends its events to
 * this path, and the Nitro route rule in `apps/www/vite.config.ts` forwards it to
 * PostHog. A neutral, app-specific path keeps analytics words out of the URL.
 */
export const POSTHOG_PROXY_PATH = "/_nakafa";
