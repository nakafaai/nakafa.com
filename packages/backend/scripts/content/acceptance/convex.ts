import { runAcceptanceCommand } from "@repo/backend/scripts/content/acceptance/command";
import type { LocalRuntime } from "@repo/backend/scripts/content/acceptance/local";
import {
  localConvexEnvironment,
  makeConvexTemporaryRoot,
} from "@repo/backend/scripts/content/acceptance/process";
import { Effect, FileSystem } from "effect";

/**
 * Runs one Convex CLI command against the running local backend and returns
 * what it printed. The command sees only the local runtime's selection: the
 * environment drops every cloud deployment value.
 */
export const runLocalConvex = Effect.fn("contentAcceptance.runLocalConvex")(
  function* (
    runtime: LocalRuntime,
    operation: string,
    args: readonly string[],
    sensitiveValues: readonly string[] = []
  ) {
    const fs = yield* FileSystem.FileSystem;
    const temporaryRoot = yield* makeConvexTemporaryRoot();
    const output = `${temporaryRoot}/output.json`;
    yield* runAcceptanceCommand({
      args: ["node_modules/convex/bin/main.js", ...args],
      command: process.execPath,
      cwd: runtime.backend,
      env: { ...localConvexEnvironment, TMPDIR: temporaryRoot },
      operation,
      reportStderr: true,
      sensitiveValues,
      stderrPath: `${temporaryRoot}/error.log`,
      stdoutPath: output,
    });
    return yield* fs.readFileString(output);
  },
  Effect.scoped
);
