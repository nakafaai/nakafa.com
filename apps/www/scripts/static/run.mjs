/**
 * Writes the static artifacts of the release into the client output. It runs after
 * the client build, from `vite.config.ts`, with the output directory as its argument.
 *
 * The app's modules read Vite's own environment (`import.meta.env`) and resolve its
 * virtual modules, so the artifacts are rendered by Vite's module runner from the
 * same configuration, in Node. `NAKAFA_STATIC_RUNNER` turns off the Cloudflare
 * plugin and maps `cloudflare:workers` to the build shim for that run.
 */
import { createServer } from "vite";

const outDir = process.argv[2];
if (outDir === undefined) {
  throw new Error(
    "Usage: node scripts/static/run.mjs <client output directory>"
  );
}

process.env.NAKAFA_STATIC_RUNNER = "1";

const server = await createServer({
  appType: "custom",
  configFile: "vite.config.ts",
  logLevel: "warn",
  root: process.cwd(),
  server: { hmr: false, middlewareMode: true, ws: false },
});

try {
  const { buildStaticArtifacts } = await server.ssrLoadModule(
    "/scripts/static/build.ts"
  );
  await buildStaticArtifacts(outDir);
} finally {
  await server.close();
}
