import { existsSync, readdirSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { basename, join } from "node:path";
import { local as textBinding } from "@alchemy.run/cloudflare-runtime/core/bindings/Text";
import cloudflare from "@alchemy.run/cloudflare-runtime/vite";
import { ACTIVE_APP_LOCALE_CODES } from "@nakafa/aksara-contracts/locale";
import babel from "@rolldown/plugin-babel";
import tailwindcss from "@tailwindcss/vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import react, { reactCompilerPreset } from "@vitejs/plugin-react";
import rsc from "@vitejs/plugin-rsc";
import { defineConfig, type Plugin } from "vite";
import { workerEnvironment, workerSettings } from "#www/worker";

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
  const written = readdirSync(clientOutputDirectory, {
    encoding: "utf8",
    recursive: true,
  })
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

/** The signature verifiers that `@nakafa/aksara-contracts` exports under `node` only. */
const NODE_ONLY_CONTRACT_PATHS = [
  "artifact/verify",
  "preview/auth",
  "runtime/protected/verify",
  "runtime/verify",
  "tryout/runtime/verify",
];

const contractsRequire = createRequire(import.meta.url);

const NODE_ONLY_CONTRACT_ALIASES = NODE_ONLY_CONTRACT_PATHS.map((path) => ({
  find: `@nakafa/aksara-contracts/${path}`,
  replacement: contractsRequire.resolve(`@nakafa/aksara-contracts/${path}`),
}));

/** The Worker environments: `ssr` is the Worker entry and `rsc` its child. */
const WORKER_ENVIRONMENTS = ["ssr", "rsc"];

/**
 * `@vitejs/plugin-rsc` excludes every package that peers on React from
 * pre-bundling, so client references keep their own modules. A CommonJS package
 * in that list stays a bare import inside the pre-bundled chunks, which Node
 * resolves but the workerd module runner cannot. These have no client
 * references, so the Worker environments pre-bundle them again.
 */
const COMMONJS_REACT_PEERS = ["use-sync-external-store"];

const bundleCommonJsReactPeers: Plugin = {
  name: "www:bundle-commonjs-react-peers",
  configEnvironment: {
    order: "post",
    handler: (name, config) => {
      if (!WORKER_ENVIRONMENTS.includes(name)) {
        return;
      }
      const exclude = config.optimizeDeps?.exclude ?? [];
      config.optimizeDeps = {
        ...config.optimizeDeps,
        exclude: exclude.filter((name) => !COMMONJS_REACT_PEERS.includes(name)),
      };
    },
  },
};

/** The font files that the font-src policy must load from this origin, never inline. */
const FONT_FILE_PATTERN = /\.woff2?$/;

/**
 * Alchemy's Cloudflare plugin runs the Worker in workerd under `vite dev`,
 * `vite build` (prerender included) and `vite preview`, with the server
 * environment that `workerEnvironment` reads as plain-text bindings. When Alchemy
 * runs the build itself, it sets ALCHEMY_CLOUDFLARE_VITE_INJECTED and adds its
 * own copy, so this one stands down.
 */
const alchemyWorker =
  process.env.ALCHEMY_CLOUDFLARE_VITE_INJECTED === "1"
    ? []
    : [
        cloudflare({
          compatibilityDate: workerSettings.compatibilityDate,
          compatibilityFlags: workerSettings.compatibilityFlags,
          viteEnvironments: workerSettings.viteEnvironments,
          worker: {
            bindings: Object.entries(workerEnvironment()).flatMap(
              ([name, value]) =>
                value === undefined ? [] : [textBinding(name, value)]
            ),
            name: workerSettings.name,
          },
        }),
      ];

export default defineConfig({
  build: {
    // The font-src policy allows only this origin, so a font file stays a file
    // even when it is smaller than the inline limit. Other assets keep the limit.
    assetsInlineLimit: (filePath) =>
      FONT_FILE_PATTERN.test(filePath) ? false : undefined,
  },
  define: {
    "import.meta.env.VITE_VERCEL_DEPLOYMENT_ID": JSON.stringify(
      process.env.VERCEL_DEPLOYMENT_ID ?? ""
    ),
  },
  resolve: {
    // `@nakafa/aksara-contracts` ships its signature verifiers under the `node`
    // condition only. Workers resolve them by file, since the `workerd` condition
    // does not match and the `node` condition would select posthog-node's Node build.
    alias: NODE_ONLY_CONTRACT_ALIASES,
    tsconfigPaths: true,
  },
  // takumi-js loads its native `@takumi-rs/core` addon at runtime. A bundled copy
  // cannot find its platform binary, so the server pass keeps the package external.
  environments: {
    ssr: {
      optimizeDeps: { include: ["@vercel/functions"] },
      resolve: { external: ["@takumi-rs/core"] },
    },
  },
  plugins: [
    tanstackStart({
      // The default rules stay in both passes: the browser rejects `.server`
      // modules, and the server pass rejects `.client` modules, so a module
      // that the server imports carries no `.client` suffix. The boundary is
      // recorded in docs/adr/0036-boundary.md.
      importProtection: {
        behavior: { dev: "error", build: "error" },
        // Node built-ins have no browser build. The default client specifiers
        // stay, and this one adds every `node:` specifier, subpaths included.
        client: { specifiers: [/^node:/] },
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
    rsc(),
    tailwindcss(),
    react(),
    babel({ presets: [reactCompilerPreset()] }),
    bundleCommonJsReactPeers,
    verifyPrerenderedPages,
    ...alchemyWorker,
  ],
});
