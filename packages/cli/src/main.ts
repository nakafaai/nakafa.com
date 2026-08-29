#!/usr/bin/env node

import * as NodeHttpClient from "@effect/platform-node/NodeHttpClient";
import * as NodeRuntime from "@effect/platform-node/NodeRuntime";
import * as NodeServices from "@effect/platform-node/NodeServices";
import { Cause, Effect, Layer } from "effect";
import { writeJson } from "#cli/output";
import { readPackageVersion } from "#cli/package";
import { runCli } from "#cli/program";

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
  Effect.catchCause((cause) =>
    Cause.hasInterruptsOnly(cause)
      ? Effect.failCause(cause)
      : reportStartupFailure(cause).pipe(Effect.as(4))
  ),
  Effect.tap((exitCode) =>
    Effect.sync(() => {
      process.exitCode = exitCode;
    })
  ),
  Effect.provide(Layer.mergeAll(NodeServices.layer, NodeHttpClient.layerFetch))
);

NodeRuntime.runMain(program, { disableErrorReporting: true });
