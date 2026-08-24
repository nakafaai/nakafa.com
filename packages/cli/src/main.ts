#!/usr/bin/env node

import { Cause, Effect } from "effect";
import { readCliEnvironment } from "./environment.js";
import { readPackageVersion } from "./package.js";
import { runCli } from "./program.js";

const program = Effect.gen(function* () {
  const [environment, version] = yield* Effect.all([
    readCliEnvironment(),
    readPackageVersion(new URL("../package.json", import.meta.url)),
  ]);
  return yield* runCli(process.argv.slice(2), {
    apiEdgeSecret: environment.apiEdgeSecret,
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
  )
);

Effect.runPromise(program).then((exitCode) => {
  process.exitCode = exitCode;
});
