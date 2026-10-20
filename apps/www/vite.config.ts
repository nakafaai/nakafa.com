import { ACTIVE_APP_LOCALE_CODES } from "@nakafa/aksara-contracts/locale";
import { POSTHOG_PROXY_PATH } from "@repo/analytics/posthog/config";
import { securityHeaders } from "@repo/site";
import { AGENT_DISCOVERY_HEADERS } from "@repo/site/discovery";
import babel from "@rolldown/plugin-babel";
import tailwindcss from "@tailwindcss/vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import react, { reactCompilerPreset } from "@vitejs/plugin-react";
import { nitro } from "nitro/vite";
import { defineConfig } from "vite";

/**
 * The PostHog proxy origin that the build names. Without one, no proxy route is
 * installed, so analytics requests never leave the app for an unset provider.
 */
const POSTHOG_PROXY_ORIGIN = process.env.POSTHOG_PROXY_HOST;

/** Every response carries the security headers and the agent discovery links. */
const SHARED_HEADERS = Object.fromEntries(
  [...securityHeaders, ...AGENT_DISCOVERY_HEADERS].map(({ key, value }) => [
    key,
    value,
  ])
);

/**
 * The marketing pages that prerender in every active locale. Their first HTML is
 * complete at build time, so the server never reads them at request time. The
 * crawl stays off, so the footer links of a page never queue more pages.
 */
const PRERENDERED_PAGES = ACTIVE_APP_LOCALE_CODES.flatMap((locale) => [
  { path: `/${locale}` },
  { path: `/${locale}/contributor` },
  { path: `/${locale}/pricing` },
]);

export default defineConfig({
  resolve: {
    tsconfigPaths: true,
  },
  plugins: [
    tanstackStart({
      srcDirectory: "app",
      importProtection: { behavior: { dev: "error", build: "error" } },
      pages: PRERENDERED_PAGES,
      // Only the listed pages prerender: discovery would add the root route,
      // whose 307 answer depends on the request, and a failed page fails the build.
      prerender: {
        autoStaticPathsDiscovery: false,
        crawlLinks: false,
        enabled: true,
        failOnError: true,
      },
    }),
    // Decision 14: no skew route (__vdpl). Server-function calls carry the
    // pinned deployment through Start's client fetch seam instead.
    nitro({
      routeRules: {
        ...(POSTHOG_PROXY_ORIGIN === undefined
          ? {}
          : {
              [`${POSTHOG_PROXY_PATH}/**`]: {
                proxy: `${POSTHOG_PROXY_ORIGIN}/**`,
              },
            }),
        "/**": { headers: SHARED_HEADERS },
      },
      vercel: { skewProtection: false },
    }),
    tailwindcss(),
    react(),
    babel({ presets: [reactCompilerPreset()] }),
  ],
});
