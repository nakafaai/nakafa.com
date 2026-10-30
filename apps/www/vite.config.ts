import { spawn } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { join, resolve } from "node:path";
import { local as assetsBinding } from "@alchemy.run/cloudflare-runtime/core/bindings/assets/Assets";
import { local as textBinding } from "@alchemy.run/cloudflare-runtime/core/bindings/Text";
import cloudflare from "@alchemy.run/cloudflare-runtime/vite";
import babel from "@rolldown/plugin-babel";
import tailwindcss from "@tailwindcss/vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import react, { reactCompilerPreset } from "@vitejs/plugin-react";
import rsc from "@vitejs/plugin-rsc";
import { Result, Schema } from "effect";
import { defineConfig, type Plugin, type PluginOption } from "vite";
import {
  deferStaticPageScripts,
  notFoundPages,
  verifyPrerenderedPages,
  writeNotFoundPages,
  writeStaticAnswers,
} from "#www/prerender.config";
import { staticPagePath } from "#www/src/lib/routing/prerendered";
import { SCHOOL_SHELL_PATH } from "#www/src/lib/routing/school/shell";
import {
  createWwwHeaders,
  readWwwHeaderOrigins,
  renderHeadersFile,
} from "#www/src/lib/security/headers";
import { renderRobotsTxt } from "#www/src/lib/seo/robots";
import { PRERENDER_HEADER } from "#www/src/lib/static/calls";
import { STATIC_HEADER_RULES } from "#www/src/lib/static/headers";
import { PrerenderedPagesJson } from "#www/src/lib/static/prerender";
import { workerEnvironment, workerSettings } from "#www/worker";

/**
 * The file where the static runner writes the public paths that the build
 * prerenders. TanStack reads its page list from the config before the build runs,
 * so the list is written first, by a separate process.
 */
const PAGE_LIST_FILE = join(import.meta.dirname, ".cache/static-pages.json");

/** How many prerender requests run at once. Set, so the build machine's core count never changes the output. */
const PRERENDER_CONCURRENCY = 8;

/**
 * Reads the public paths that the build prerenders. The static runner writes them
 * from the active release, so an absent release fails the build here.
 */
function readPrerenderedPagePaths(): Promise<readonly string[]> {
  return new Promise((resolve, reject) => {
    const runner = spawn(
      process.execPath,
      [
        join(import.meta.dirname, "scripts/static/run.mjs"),
        "pages",
        PAGE_LIST_FILE,
      ],
      { cwd: import.meta.dirname, env: process.env, stdio: "inherit" }
    );
    runner.on("error", reject);
    runner.on("exit", (code, signal) => {
      if (code !== 0) {
        reject(new Error(`The page list failed with exit ${code ?? signal}.`));
        return;
      }
      resolve(
        Schema.decodeSync(PrerenderedPagesJson)(
          readFileSync(PAGE_LIST_FILE, "utf8")
        )
      );
    });
  });
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
            renderHeadersFile([
              {
                headers: createWwwHeaders(readWwwHeaderOrigins()),
                path: "/*",
              },
              ...STATIC_HEADER_RULES,
            ]),
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
 * The asset settings of the Worker that the Alchemy plugin runs. A deploy applies
 * the `_headers` file of the client output to the static assets, but `vite
 * preview` reads the rules only from these settings, so `readPreviewHeaders`
 * fills them from the built file before the preview starts its Worker.
 */
const workerAssets: typeof workerSettings.assets & { headers?: string } = {
  ...workerSettings.assets,
};

/**
 * Gives the preview's Worker the rules of the built `_headers` file, so a local
 * production build, the acceptance runtime included, answers a static asset with
 * the same headers as the deploy. It runs before the Alchemy plugin starts the
 * Worker.
 */
const readPreviewHeaders: Plugin = {
  configurePreviewServer: {
    order: "pre",
    handler: (server) => {
      const file = join(
        resolve(
          server.config.root,
          server.config.environments.client.build.outDir
        ),
        "_headers"
      );
      if (existsSync(file)) {
        workerAssets.headers = readFileSync(file, "utf8");
      }
    },
  },
  name: "www:read-preview-headers",
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

/**
 * Writes the static artifacts of the release into the client output: the sitemap,
 * the feeds and the indexes, and every social image. The runner renders them with
 * the app's own modules in Node, after the client build, so the Worker answers
 * none of these addresses.
 */
const writeStaticArtifacts: Plugin = {
  apply: "build",
  // The Markdown twins link from the prerendered pages, so this writer runs after
  // TanStack has written them, and before the verifier, which reads the same output.
  enforce: "post",
  buildApp: {
    order: "post",
    handler: (builder) =>
      new Promise<void>((resolve, reject) => {
        const runner = spawn(
          process.execPath,
          [
            join(import.meta.dirname, "scripts/static/run.mjs"),
            "artifacts",
            builder.environments.client.config.build.outDir,
            PAGE_LIST_FILE,
          ],
          { cwd: import.meta.dirname, env: process.env, stdio: "inherit" }
        );
        runner.on("error", reject);
        runner.on("exit", (code, signal) => {
          if (code === 0) {
            resolve();
            return;
          }
          reject(
            new Error(
              `The static artifacts failed with exit ${code ?? signal}.`
            )
          );
        });
      }),
  },
  name: "www:write-static-artifacts",
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

/**
 * The static runner executes the app's modules in Node to write the static
 * artifacts. It runs without the Worker plugin, and `cloudflare:workers` resolves
 * to the build's stand-in for that run only.
 */
const STATIC_RUNNER = process.env.NAKAFA_STATIC_RUNNER === "1";

const STATIC_RUNNER_ALIASES = STATIC_RUNNER
  ? [
      {
        find: "cloudflare:workers",
        replacement: join(import.meta.dirname, "scripts/static/workers.ts"),
      },
    ]
  : [];

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

/**
 * `esm-env` answers `BROWSER` with the `browser` export condition, and the Worker
 * environments resolve with it (`workerd`, `worker`, `module`, `browser`, as
 * Cloudflare's plugin does). workerd is no browser, so there `esm-env/browser`
 * is `false`, as esm-env's own fallback (`typeof window !== "undefined"`) finds
 * at runtime. Otherwise every library that asks renders as it would in a
 * browser: NumberFlow's server markup came out empty, so a try-out section
 * showed no numbers until it hydrated. The Worker environments pre-bundle no
 * `esm-env`, because Vite's dependency optimizer resolves with its alias and
 * resolve plugins only, never this one.
 */
const ESM_ENV_BROWSER = "esm-env/browser";
const WORKER_ESM_ENV_BROWSER = "\0www:esm-env-browser";

const workerIsNoBrowser: Plugin = {
  name: "www:worker-is-no-browser",
  enforce: "pre",
  applyToEnvironment: (environment) =>
    WORKER_ENVIRONMENTS.includes(environment.name),
  configEnvironment: (name, config) => {
    if (!WORKER_ENVIRONMENTS.includes(name)) {
      return;
    }
    config.optimizeDeps = {
      ...config.optimizeDeps,
      exclude: [...(config.optimizeDeps?.exclude ?? []), "esm-env"],
    };
  },
  resolveId: (source) =>
    source === ESM_ENV_BROWSER ? WORKER_ESM_ENV_BROWSER : undefined,
  load: (id) =>
    id === WORKER_ESM_ENV_BROWSER ? "export default false;" : undefined,
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
 *
 * `vite preview` of a finished build, the acceptance server's, binds the release's
 * assets as `ASSETS`, as the deployed Worker does, so its static-first answers
 * (`hasStaticRelease`) run there too. The prerender and `vite dev` bind none,
 * because no release exists yet and every route renders.
 */
function alchemyWorker(
  nodeEnvironment: "development" | "production",
  preview: boolean
): PluginOption[] {
  const isAlchemyBuild = process.env.ALCHEMY_CLOUDFLARE_VITE_INJECTED === "1";
  const isPrerendering = process.env.TSS_PRERENDERING === "true";
  if (STATIC_RUNNER || (isAlchemyBuild && !isPrerendering)) {
    return [];
  }
  return [
    cloudflare({
      compatibilityDate: workerSettings.compatibilityDate,
      compatibilityFlags: workerSettings.compatibilityFlags,
      viteEnvironments: workerSettings.viteEnvironments,
      worker: {
        assets: workerAssets,
        bindings: [
          ...Object.entries({
            ...workerEnvironment(),
            NODE_ENV: nodeEnvironment,
          }).flatMap(([name, value]) =>
            value === undefined ? [] : [textBinding(name, value)]
          ),
          ...(preview && !isPrerendering ? [assetsBinding("ASSETS")] : []),
        ],
        name: workerSettings.name,
      },
    }),
  ];
}

/**
 * The pages to prerender. Only the build's own process reads the list: the
 * static runner, the prerender's preview server and the dev server render no
 * page list, so they skip the release read.
 */
function listPrerenderedPages(
  command: "build" | "serve"
): Promise<readonly string[]> {
  if (command !== "build" || STATIC_RUNNER) {
    return Promise.resolve([]);
  }
  return readPrerenderedPagePaths();
}

export default defineConfig(async ({ command, isPreview }) => {
  const prerenderedPages = await listPrerenderedPages(command);
  return {
    build: {
      // The font-src policy allows only this origin, so a font file stays a file
      // even when it is smaller than the inline limit. Other assets keep the limit.
      assetsInlineLimit: (filePath: string) =>
        FONT_FILE_PATTERN.test(filePath) ? false : undefined,
    },
    environments: {
      // Workers Logs maps stack traces without the embedded sources, and the
      // upload refuses more than 60 MiB of maps: the sources were 47 of 65 MiB.
      [workerSettings.viteEnvironments.entry]: {
        build: {
          rolldownOptions: { output: { sourcemapExcludeSources: true } },
        },
      },
    },
    resolve: {
      // `@nakafa/aksara-contracts` ships its signature verifiers under the `node`
      // condition only. Workers resolve them by file, since the `workerd` condition
      // does not match and the `node` condition would select posthog-node's Node build.
      alias: [...NODE_ONLY_CONTRACT_ALIASES, ...STATIC_RUNNER_ALIASES],
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
        // A build that lists no public page, as the static runner's, prerenders none.
        pages:
          prerenderedPages.length === 0
            ? []
            : [
                ...prerenderedPages.map((path) => ({
                  path,
                  prerender: { outputPath: staticPagePath(path) },
                })),
                ...notFoundPages,
              ],
        // A school renders only in the browser (ADR 0038 D2). The build prerenders
        // the root document once as the school shell, at `/_school`, and the
        // Worker answers every school page with it. The root path redirects to a
        // locale, and the shell renders the root route alone at that address.
        spa:
          prerenderedPages.length === 0
            ? undefined
            : {
                enabled: true,
                maskPath: "/",
                prerender: { outputPath: SCHOOL_SHELL_PATH },
              },
        // Server Components: content bodies render on the server, and only "use
        // client" islands ship JavaScript. An island's heavy module loads on
        // intent, never in the first load of the route.
        rsc: { enabled: true },
        // Only the listed pages prerender: discovery would add the root route,
        // whose 307 answer depends on the request. A failed page does not fail
        // the build by itself; verifyPrerenderedPages does.
        prerender: {
          autoStaticPathsDiscovery: false,
          concurrency: PRERENDER_CONCURRENCY,
          crawlLinks: false,
          enabled: true,
          failOnError: true,
          // The Worker records each page's server function calls, which
          // writeStaticAnswers turns into static files.
          headers: { [PRERENDER_HEADER]: "1" },
        },
      }),
      // No deployment pin route: a client that asks for a
      // chunk the deploy replaced reloads the document once.
      rsc(),
      tailwindcss(),
      react(),
      babel({ presets: [reactCompilerPreset()] }),
      bundleCommonJsReactPeers,
      workerIsNoBrowser,
      writeHeadersFile,
      readPreviewHeaders,
      writeRobotsFile,
      serveRobotsFile,
      writeStaticArtifacts,
      writeStaticAnswers(prerenderedPages),
      deferStaticPageScripts(prerenderedPages),
      writeNotFoundPages(prerenderedPages),
      verifyPrerenderedPages(prerenderedPages),
      // `vite dev` runs the Worker as Node runs a development server. `vite build`
      // and `vite preview`, the acceptance server and the prerender included, run
      // it as the deployed Worker does.
      ...alchemyWorker(
        command === "serve" && !isPreview ? "development" : "production",
        isPreview === true
      ),
    ],
  };
});
