import { existsSync, readdirSync, readFileSync } from "node:fs";
import { basename, join } from "node:path";
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
 * The marker that React writes where a Suspense boundary failed on the server, so
 * the browser renders that part. A page that carries it is a server failure.
 */
const SERVER_FAILURE_MARKER = "<!--$!-->";

/**
 * TanStack runs each prerender task in a queue whose failures nobody awaits: a
 * page that fails only logs an unhandled rejection, and the build still exits 0.
 * This check throws unless the client output directory, the output that Nitro's
 * preset sets and TanStack prerenders into, holds exactly the listed pages and
 * none of them carries a server failure marker.
 */
function assertPrerenderedPages(clientOutputDirectory: string) {
  const expected = PRERENDERED_PAGES.map(({ path }) =>
    join(clientOutputDirectory, path, "index.html")
  );
  const written = readdirSync(clientOutputDirectory, { recursive: true })
    .filter((entry) => basename(entry) === "index.html")
    .map((entry) => join(clientOutputDirectory, entry));
  const problems = [
    ...expected
      .filter((file) => !existsSync(file))
      .map((file) => `no page at ${file}`),
    ...written
      .filter((file) => !expected.includes(file))
      .map((file) => `unlisted page at ${file}`),
    ...expected
      .filter(
        (file) =>
          existsSync(file) &&
          readFileSync(file, "utf8").includes(SERVER_FAILURE_MARKER)
      )
      .map((file) => `server failure in ${file}`),
  ];
  if (problems.length > 0) {
    throw new Error(
      `The prerendered pages are not the listed set:\n${problems.join("\n")}`
    );
  }
}

const verifyPrerenderedPages: Plugin = {
  apply: "build",
  // TanStack's prerender is a post plugin too; this check must run after it.
  enforce: "post",
  // After every environment is built and TanStack has prerendered the pages.
  buildApp: {
    order: "post",
    handler: (builder) =>
      Promise.resolve(
        assertPrerenderedPages(builder.environments.client.config.build.outDir)
      ),
  },
  name: "www:verify-prerendered-pages",
};

/** The font files that the font-src policy must load from this origin, never inline. */
const FONT_FILE_PATTERN = /\.woff2?$/;

export default defineConfig({
  build: {
    // The font-src policy allows only this origin, so a font file stays a file
    // even when it is smaller than the inline limit. Other assets keep the limit.
    assetsInlineLimit: (filePath) =>
      FONT_FILE_PATTERN.test(filePath) ? false : undefined,
  },
  resolve: {
    tsconfigPaths: true,
  },
  // takumi-js loads its native `@takumi-rs/core` addon at runtime. A bundled copy
  // cannot find its platform binary, so the server pass keeps the package external.
  environments: {
    ssr: {
      resolve: { external: ["@takumi-rs/core"] },
    },
  },
  plugins: [
    tanstackStart({
      srcDirectory: "app",
      // Client components render on the server during the RSC pass, so their
      // `.client` modules belong to the server bundle. The browser keeps its
      // rule against `.server` modules; the server pass has no `.client` rule.
      importProtection: {
        behavior: { dev: "error", build: "error" },
        server: { files: [] },
      },
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
