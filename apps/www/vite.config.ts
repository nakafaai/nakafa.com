import { existsSync } from "node:fs";
import { join } from "node:path";
import { ACTIVE_APP_LOCALE_CODES } from "@nakafa/aksara-contracts/locale";
import { POSTHOG_PROXY_PATH } from "@repo/analytics/posthog/config";
import { securityHeaders } from "@repo/site";
import { AGENT_DISCOVERY_HEADERS } from "@repo/site/discovery";
import babel from "@rolldown/plugin-babel";
import tailwindcss from "@tailwindcss/vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import react, { reactCompilerPreset } from "@vitejs/plugin-react";
import rsc from "@vitejs/plugin-rsc";
import { nitro } from "nitro/vite";
import { defineConfig, type Plugin } from "vite";

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

/**
 * The client output that Nitro's preset writes: Vercel's static directory on
 * Vercel, and the public directory of the Node preset elsewhere.
 */
const CLIENT_OUTPUT_DIRECTORY =
  process.env.VERCEL === "1" ? ".vercel/output/static" : ".output/public";

/**
 * TanStack runs each prerender task in a queue whose failures nobody awaits: a
 * page that fails only logs an unhandled rejection, and the build still exits 0.
 * This check fails the build when a listed page did not reach the client output.
 */
/** Throws when a listed page is missing from the client output. */
function assertPrerenderedPages() {
  const missing = PRERENDERED_PAGES.map(({ path }) => path).filter(
    (path) => !existsSync(join(CLIENT_OUTPUT_DIRECTORY, path, "index.html"))
  );
  if (missing.length > 0) {
    throw new Error(
      `Prerendering wrote no page for: ${missing.join(", ")} (${CLIENT_OUTPUT_DIRECTORY})`
    );
  }
}

const verifyPrerenderedPages: Plugin = {
  apply: "build",
  // After every environment is built and TanStack has prerendered the pages.
  buildApp: {
    order: "post",
    handler: () => Promise.resolve(assertPrerenderedPages()),
  },
  name: "www:verify-prerendered-pages",
};

export default defineConfig({
  resolve: {
    tsconfigPaths: true,
  },
  plugins: [
    tanstackStart({
      srcDirectory: "app",
      importProtection: { behavior: { dev: "error", build: "error" } },
      pages: PRERENDERED_PAGES,
      // Server Components: content bodies render on the server, and only "use
      // client" islands ship JavaScript. An island's heavy module loads on
      // intent, never in the first load of the route.
      rsc: { enabled: true },
      // Only the listed pages prerender: discovery would add the root route,
      // whose 307 answer depends on the request. A failed page does not fail
      // the build by itself; verifyPrerenderedPages does.
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
      // The server bundle has no WebAssembly module. Nitro's wasm support adds
      // the `unwasm` export condition, which selects takumi-js's wasm backend,
      // since its `#backend` map lists `unwasm` before `node`. Without it,
      // takumi-js loads its native Node backend, as Next did before.
      wasm: false,
      vercel: { skewProtection: false },
    }),
    rsc(),
    tailwindcss(),
    react(),
    babel({ presets: [reactCompilerPreset()] }),
    verifyPrerenderedPages,
  ],
});
