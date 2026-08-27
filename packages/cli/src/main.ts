#!/usr/bin/env node

import * as NodeFileSystem from "@effect/platform-node/NodeFileSystem";
import { Cause, Effect } from "effect";
import { readPackageVersion } from "#cli/package";
import { runCli } from "#cli/program";

const program = Effect.gen(function* () {
  const version = yield* readPackageVersion(
    new URL("../package.json", import.meta.url)
  );
  return yield* runCli(process.argv.slice(2), {
    fetchImplementation: fetch,
    stderr: process.stderr,
    stdout: process.stdout,
    version,
  });
}).pipe(
  Effect.catchCause((cause) =>
    Effect.sync(() => {
      process.stderr.write(
        `${JSON.stringify({
          code: "CLI_STARTUP_ERROR",
          message: Cause.pretty(cause),
        })}\n`
      );
      return 4;
    })
  ),
  Effect.provide(NodeFileSystem.layer)
);

Effect.runPromise(program).then((exitCode) => {
  process.exitCode = exitCode;
});
