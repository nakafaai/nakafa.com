import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
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
import { Result } from "effect";
import { defineConfig, type Plugin, type PluginOption } from "vite";
import {
  createWwwHeaders,
  readWwwHeaderOrigins,
  renderHeadersFile,
} from "#www/src/lib/security/headers";
import { renderRobotsTxt } from "#www/src/lib/seo/robots";
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
 * This check throws unless the client output directory, the directory that
 * TanStack prerenders into, holds exactly the listed pages and none of them
 * carries a server failure marker.
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

/**
 * Writes the `_headers` file of the client output, so the static assets, the
 * prerendered pages included, carry the headers that the Worker sets on its own
 * answers. Both read the same list from `src/lib/security/headers.ts`.
 */
const writeHeadersFile: Plugin = {
  apply: "build",
  buildApp: {
    order: "post",
    handler: (builder) =>
      Promise.resolve(
        writeFileSync(
          join(builder.environments.client.config.build.outDir, "_headers"),
          Result.getOrThrowWith(
            renderHeadersFile(createWwwHeaders(readWwwHeaderOrigins())),
            (error) =>
              new Error(
                `A _headers line is over the platform limit: ${error.prefix}...`
              )
          )
        )
      ),
  },
  name: "www:write-headers-file",
};

/**
 * Writes robots.txt into the client output, so the static assets serve it and it
 * costs no Worker request. Its rules come from the crawler registry.
 */
const writeRobotsFile: Plugin = {
  apply: "build",
  buildApp: {
    order: "post",
    handler: (builder) =>
      Promise.resolve(
        writeFileSync(
          join(builder.environments.client.config.build.outDir, "robots.txt"),
          renderRobotsTxt()
        )
      ),
  },
  name: "www:write-robots-file",
};

/**
 * Answers robots.txt in `vite dev`, where the build writer does not run. The
 * middleware sits before Vite's own handlers, so the router never sees the request.
 */
const serveRobotsFile: Plugin = {
  apply: "serve",
  configureServer: (server) => {
    server.middlewares.use((request, response, next) => {
      const { pathname } = new URL(request.url ?? "/", "http://localhost");
      if (pathname !== "/robots.txt") {
        next();
        return;
      }
      response.setHeader("Content-Type", "text/plain; charset=utf-8");
      response.end(renderRobotsTxt());
    });
  },
  name: "www:serve-robots-file",
};

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

/** The Node built-in specifiers, which have no browser build. */
const NODE_BUILTIN_SPECIFIER = /^node:/;

/**
 * Alchemy's Cloudflare plugin runs the Worker in workerd under `vite dev`,
 * `vite build` (prerender included) and `vite preview`, with the server
 * environment of `workerEnvironment` as plain-text bindings. Alchemy's own build
 * sets ALCHEMY_CLOUDFLARE_VITE_INJECTED and adds its plugin, so this copy stands
 * down there. TanStack's prerender preview reloads this file with
 * TSS_PRERENDERING set and no Alchemy plugin, so this copy runs for it.
 */
function alchemyWorker(
  nodeEnvironment: "development" | "production"
): PluginOption[] {
  const isAlchemyBuild = process.env.ALCHEMY_CLOUDFLARE_VITE_INJECTED === "1";
  const isPrerendering = process.env.TSS_PRERENDERING === "true";
  if (isAlchemyBuild && !isPrerendering) {
    return [];
  }
  return [
    cloudflare({
      compatibilityDate: workerSettings.compatibilityDate,
      compatibilityFlags: workerSettings.compatibilityFlags,
      viteEnvironments: workerSettings.viteEnvironments,
      worker: {
        bindings: Object.entries({
          ...workerEnvironment(),
          NODE_ENV: nodeEnvironment,
        }).flatMap(([name, value]) =>
          value === undefined ? [] : [textBinding(name, value)]
        ),
        name: workerSettings.name,
      },
    }),
  ];
}

export default defineConfig(({ command, isPreview }) => ({
  build: {
    // The font-src policy allows only this origin, so a font file stays a file
    // even when it is smaller than the inline limit. Other assets keep the limit.
    assetsInlineLimit: (filePath) =>
      FONT_FILE_PATTERN.test(filePath) ? false : undefined,
  },
  resolve: {
    // `@nakafa/aksara-contracts` ships its signature verifiers under the `node`
    // condition only. Workers resolve them by file, since the `workerd` condition
    // does not match and the `node` condition would select posthog-node's Node build.
    alias: NODE_ONLY_CONTRACT_ALIASES,
    tsconfigPaths: true,
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
        client: { specifiers: [NODE_BUILTIN_SPECIFIER] },
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
    // Decision 34: no deployment pin and no skew route. A client that asks for a
    // chunk the deploy replaced reloads the document once.
    rsc(),
    tailwindcss(),
    react(),
    babel({ presets: [reactCompilerPreset()] }),
    bundleCommonJsReactPeers,
    writeHeadersFile,
    writeRobotsFile,
    serveRobotsFile,
    verifyPrerenderedPages,
    // `vite dev` runs the Worker as Node runs a development server. `vite build`
    // and `vite preview`, the acceptance server and the prerender included, run
    // it as the deployed Worker does.
    ...alchemyWorker(
      command === "serve" && !isPreview ? "development" : "production"
    ),
  ],
}));
