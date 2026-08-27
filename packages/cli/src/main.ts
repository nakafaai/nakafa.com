#!/usr/bin/env node

import * as NodeHttpClient from "@effect/platform-node/NodeHttpClient";
import * as NodeRuntime from "@effect/platform-node/NodeRuntime";
import * as NodeServices from "@effect/platform-node/NodeServices";
import { Cause, Data, Effect, Layer, Runtime } from "effect";
import { writeJson } from "#cli/output";
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
    yield* writeJson(
      "stderr",
      {
        code: "CLI_STARTUP_ERROR",
        message: Cause.pretty(cause),
      },
      false
    );
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
  Effect.provide(Layer.mergeAll(NodeServices.layer, NodeHttpClient.layerFetch))
);

NodeRuntime.runMain(program, { disableErrorReporting: true });
