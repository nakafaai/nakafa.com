import type { ChildProcess } from "node:child_process";
import { spawn } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { Schema } from "effect";
import { PrerenderedPagesJson } from "#www/src/lib/static/prerender";

/*
 * The build's static runner (`scripts/static/run.ts build`), which renders with
 * the app's own modules in Node. One process serves the whole build: it lists the
 * pages before the build, since TanStack reads its page list from the config
 * before the build exists; it derives the Markdown twins and parses the diagrams
 * while the client build and the prerender run; and it writes the static
 * artifacts once the build asks after the prerender. So the app's modules load
 * once, and that work waits on nothing the prerender writes.
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

/** The runner has written the page list to `file`. */
export const PagesListed = Schema.TaggedStruct("pages", {
  file: Schema.NonEmptyString,
});

/** The prerender has written its pages: the runner writes the static artifacts into `outDir`. */
export const WriteArtifacts = Schema.TaggedStruct("write", {
  outDir: Schema.NonEmptyString,
});

/** What the build and its static runner tell each other over the runner's IPC channel. */
export const RunnerMessage = Schema.Union([PagesListed, WriteArtifacts]);

/** This build's static runner, from the page list until it has written the artifacts. */
let staticRunner: ChildProcess | undefined;

/**
 * Reads the public paths that the build prerenders. The static runner writes them
 * from the active release, so an absent release fails the build here. The runner
 * then lets this process end without it, until the build asks it for the artifacts.
 */
export function readPrerenderedPagePaths(): Promise<readonly string[]> {
  return new Promise((resolve, reject) => {
    const runner = spawn(
      process.execPath,
      [
        join(import.meta.dirname, "scripts/static/run.ts"),
        "build",
        PAGE_LIST_FILE,
      ],
      {
        cwd: import.meta.dirname,
        env: STATIC_RUNNER_ENV,
        stdio: ["inherit", "inherit", "inherit", "ipc"],
      }
    );
    staticRunner = runner;
    runner.on("error", reject);
    runner.on("exit", (code, signal) => {
      reject(new Error(`The page list failed with exit ${code ?? signal}.`));
    });
    runner.on("message", (message) => {
      if (!Schema.is(PagesListed)(message)) {
        return;
      }
      runner.unref();
      // Node keeps the IPC channel referenced apart from the child; Bun's channel has no unref,
      // and its child unref already lets this process end.
      runner.channel?.unref?.();
      resolve(
        Schema.decodeSync(PrerenderedPagesJson)(
          readFileSync(message.file, "utf8")
        )
      );
    });
  });
}

/**
 * Writes the static artifacts of the release into the client output `outDir`:
 * the Markdown twins, the sitemap, the feeds and the indexes, and every social
 * image. The runner that listed the pages writes them and then ends.
 */
export function writeStaticArtifactFiles(outDir: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const runner = staticRunner;
    if (runner === undefined || runner.exitCode !== null) {
      reject(
        new Error(
          `The static runner ended with exit ${runner?.exitCode ?? "none"} before the static artifacts.`
        )
      );
      return;
    }
    runner.ref();
    // Bun's channel has no ref either, as it has no unref above.
    runner.channel?.ref?.();
    runner.on("exit", (code, signal) => {
      if (code === 0) {
        resolve();
        return;
      }
      reject(
        new Error(`The static artifacts failed with exit ${code ?? signal}.`)
      );
    });
    runner.send(WriteArtifacts.make({ outDir }));
  });
}
