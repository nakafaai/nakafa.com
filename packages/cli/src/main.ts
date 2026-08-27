#!/usr/bin/env node

import * as NodeFileSystem from "@effect/platform-node/NodeFileSystem";
import * as NodeHttpClient from "@effect/platform-node/NodeHttpClient";
import * as NodeRuntime from "@effect/platform-node/NodeRuntime";
import * as NodeStdio from "@effect/platform-node/NodeStdio";
import { Cause, Data, Effect, Layer, Runtime, Stdio, Stream } from "effect";
import { readPackageVersion } from "#cli/package";
import { runCli } from "#cli/program";

class CliProcessExit extends Data.TaggedError("CliProcessExit")<{
  readonly exitCode: number;
}> {
  readonly [Runtime.errorReported] = false;

  get [Runtime.errorExitCode]() {
    return this.exitCode;
  }
}

const reportStartupFailure = Effect.fn("NakafaCli.reportStartupFailure")(
  function* (cause: Cause.Cause<unknown>) {
    const stdio = yield* Stdio.Stdio;
    yield* Stream.make(
      `${JSON.stringify({
        code: "CLI_STARTUP_ERROR",
        message: Cause.pretty(cause),
      })}\n`
    ).pipe(Stream.run(stdio.stderr()));
  }
);

const program = Effect.gen(function* () {
  const version = yield* readPackageVersion(
    new URL("../package.json", import.meta.url)
  );
  return yield* runCli(process.argv.slice(2), {
    version,
  });
}).pipe(
  Effect.catchCause((cause) => reportStartupFailure(cause).pipe(Effect.as(4))),
  Effect.flatMap((exitCode) =>
    exitCode === 0 ? Effect.void : Effect.fail(new CliProcessExit({ exitCode }))
  ),
  Effect.provide(
    Layer.mergeAll(
      NodeFileSystem.layer,
      NodeHttpClient.layerFetch,
      NodeStdio.layer
    )
  )
);

NodeRuntime.runMain(program, { disableErrorReporting: true });
