/**
 * Runs the static runner's two jobs from `vite.config.ts`. `pages <file>` writes the
 * public paths that the build prerenders, before the client build. `artifacts
 * <outDir> <file>` writes the static artifacts of the release for those paths into
 * the client output, after the client build.
 *
 * The app's modules read Vite's own environment (`import.meta.env`) and resolve its
 * virtual modules, so the artifacts are rendered by Vite's module runner from the
 * same configuration, in Node. `NAKAFA_STATIC_RUNNER` turns off the Cloudflare
 * plugin and maps `cloudflare:workers` to the build shim for that run.
 */
import { createServer } from "vite";

const [job, target, pageListFile] = process.argv.slice(2);
if (target === undefined || (job !== "pages" && job !== "artifacts")) {
  throw new Error(
    "Usage: node scripts/static/run.mjs pages <file> | artifacts <client output directory> <page list file>"
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
  const build = await server.ssrLoadModule("/scripts/static/build.ts");
  if (job === "pages") {
    await build.buildStaticPagePaths(target);
  } else {
    await build.buildStaticArtifacts(target, pageListFile);
  }
} finally {
  await server.close();
}
