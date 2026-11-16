import { spawn } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { Schema } from "effect";
import { PrerenderedPagesJson } from "#www/src/lib/static/prerender";

/*
 * The build's two calls to the static runner (`scripts/static/run.ts`), which
 * renders with the app's own modules in Node: the page list before the build, and
 * the static artifacts after the client build. Each runs as its own process, since
 * TanStack reads its page list from the config before the build exists.
 */

/**
 * The file where the static runner writes the public paths that the build
 * prerenders, and where the artifacts read them back.
 */
const PAGE_LIST_FILE = join(import.meta.dirname, ".cache/static-pages.json");

/**
 * The static runner's environment: this build's own, plus the flag that turns off
 * the Cloudflare plugin in the runner's Vite server (`STATIC_RUNNER` in
 * vite.config.ts).
 */
const STATIC_RUNNER_ENV = { ...process.env, NAKAFA_STATIC_RUNNER: "1" };

/** Runs one job of the static runner, failing with `failure` and its exit when it does. */
function runStaticRunner(
  job: readonly string[],
  failure: string
): Promise<void> {
  return new Promise((resolve, reject) => {
    const runner = spawn(
      process.execPath,
      [join(import.meta.dirname, "scripts/static/run.ts"), ...job],
      { cwd: import.meta.dirname, env: STATIC_RUNNER_ENV, stdio: "inherit" }
    );
    runner.on("error", reject);
    runner.on("exit", (code, signal) => {
      if (code === 0) {
        resolve();
        return;
      }
      reject(new Error(`${failure} failed with exit ${code ?? signal}.`));
    });
  });
}

/**
 * Reads the public paths that the build prerenders. The static runner writes them
 * from the active release, so an absent release fails the build here.
 */
export async function readPrerenderedPagePaths(): Promise<readonly string[]> {
  await runStaticRunner(["pages", PAGE_LIST_FILE], "The page list");
  return Schema.decodeSync(PrerenderedPagesJson)(
    readFileSync(PAGE_LIST_FILE, "utf8")
  );
}

/**
 * Writes the static artifacts of the release into the client output `outDir`:
 * the sitemap, the feeds and the indexes, and every social image.
 */
export function writeStaticArtifactFiles(outDir: string): Promise<void> {
  return runStaticRunner(
    ["artifacts", outDir, PAGE_LIST_FILE],
    "The static artifacts"
  );
}
