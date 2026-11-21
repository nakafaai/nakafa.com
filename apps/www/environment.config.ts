import { pathToFileURL } from "node:url";
import type { Plugin } from "vite";

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
 * browser: NumberFlow's server markup came out empty until it hydrated. The
 * Worker environments pre-bundle no `esm-env`, because Vite's dependency
 * optimizer resolves with its alias and resolve plugins only, never this one.
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

/**
 * Mermaid draws a diagram only in the browser: the component renders it after
 * mount, and the static runner, which parses every diagram of the release,
 * imports it from Node (`NODE_IMPORTS`). The Worker never runs it, yet its
 * dynamic import put Mermaid, ELK and Cytoscape, about 12 MiB, into the Worker,
 * whose script Cloudflare caps at 64 MiB. The Worker environments resolve it to
 * a module that refuses to load, so a stray server call fails as a typed
 * `MermaidRenderError` instead of shipping the library.
 */
const MERMAID = "mermaid";
const WORKER_MERMAID = "\0www:mermaid";

const workerDrawsNoDiagram: Plugin = {
  name: "www:worker-draws-no-diagram",
  enforce: "pre",
  applyToEnvironment: (environment) =>
    WORKER_ENVIRONMENTS.includes(environment.name),
  resolveId: (source) => (source === MERMAID ? WORKER_MERMAID : undefined),
  load: (id) =>
    id === WORKER_MERMAID
      ? 'throw new Error("Mermaid draws in the browser, never in the Worker.");'
      : undefined,
};

/**
 * `shiki/langs` and `shiki/themes` map every grammar and theme name to a loader,
 * and each loader is a dynamic import, so a module that reads either map put
 * every grammar Shiki ships, about 9 MiB, into the Worker. The Worker highlights
 * lessons with its own closed set (`lib/code/lesson.ts`), and the browser loads
 * every other grammar on first use. The Worker environments keep each map's
 * names, read from Shiki itself at build time, so a language check answers as it
 * does in the browser, while every loader refuses, so no grammar ships.
 */
const SHIKI_MAPS = {
  "shiki/langs": "bundledLanguages",
  "shiki/themes": "bundledThemes",
} as const;
const WORKER_SHIKI = "\0www:shiki:";

const isShikiMap = (source: string): source is keyof typeof SHIKI_MAPS =>
  Object.hasOwn(SHIKI_MAPS, source);

const workerLoadsNoGrammar: Plugin = {
  name: "www:worker-loads-no-grammar",
  enforce: "pre",
  applyToEnvironment: (environment) =>
    WORKER_ENVIRONMENTS.includes(environment.name),
  async resolveId(source, importer) {
    if (!isShikiMap(source)) {
      return;
    }
    const resolved = await this.resolve(source, importer, { skipSelf: true });
    return resolved ? `${WORKER_SHIKI}${source}|${resolved.id}` : undefined;
  },
  async load(id) {
    if (!id.startsWith(WORKER_SHIKI)) {
      return;
    }
    const [source = "", file = ""] = id.slice(WORKER_SHIKI.length).split("|");
    if (!isShikiMap(source)) {
      return;
    }
    const map = SHIKI_MAPS[source];
    const shiki: Record<string, Record<string, unknown>> = await import(
      pathToFileURL(file).href
    );
    const names = Object.keys(shiki[map] ?? {});
    return [
      'const refuse = () => Promise.reject(new Error("Shiki loads grammars and themes in the browser, never in the Worker."));',
      `export const ${map} = Object.fromEntries(${JSON.stringify(names)}.map((name) => [name, refuse]));`,
    ].join("\n");
  },
};

/**
 * The plugins that shape what the Worker environments bundle. The static runner
 * runs the app's modules in Node, where Mermaid and every Shiki grammar load as
 * shipped, so it keeps both libraries whole.
 */
export function workerPlugins(staticRunner: boolean): Plugin[] {
  return [
    bundleCommonJsReactPeers,
    workerIsNoBrowser,
    ...(staticRunner ? [] : [workerDrawsNoDiagram, workerLoadsNoGrammar]),
  ];
}
