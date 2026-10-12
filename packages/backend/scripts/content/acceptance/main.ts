import { runMain } from "@effect/platform-node/NodeRuntime";
import { layer } from "@effect/platform-node/NodeServices";
import {
  prepareAcceptance,
  runAcceptance,
} from "@repo/backend/scripts/content/acceptance/build";
import { acceptanceRuntimeError } from "@repo/backend/scripts/content/acceptance/error";
import { importAcceptanceRows } from "@repo/backend/scripts/content/acceptance/import";
import { createAcceptanceLearner } from "@repo/backend/scripts/content/acceptance/learner";
import { cleanLocalRuntime } from "@repo/backend/scripts/content/acceptance/local";
import { withTerminal } from "@repo/backend/scripts/content/acceptance/process";
import { FetchClient } from "@repo/utilities/http/client";
import { Array as Arr, Effect, FileSystem, Layer } from "effect";

const main = Effect.gen(function* () {
  const fs = yield* FileSystem.FileSystem;
  const root = yield* fs.realPath(`${import.meta.dirname}/../../../../..`);
  const mode = process.argv[2];
  if (mode === "prepare") {
    return yield* prepareAcceptance(root);
  }
  if (mode === "build" || mode === "start") {
    return yield* runAcceptance(root, mode, Arr.drop(process.argv, 3));
  }
  if (mode === "clean") {
    return yield* cleanLocalRuntime(root);
  }
  const first = process.argv[3];
  const second = process.argv[4];
  if (mode === "learner" && first !== undefined) {
    return yield* createAcceptanceLearner(root, first);
  }
  if (mode === "import" && first !== undefined && second !== undefined) {
    return yield* importAcceptanceRows(root, first, second);
  }
  return yield* acceptanceRuntimeError(
    "Usage: acceptance <prepare|build|start|clean|learner <cookie-file>|import <table> <rows-file>>"
  );
});

runMain(
  withTerminal(main).pipe(Effect.provide(Layer.merge(layer, FetchClient)))
);
