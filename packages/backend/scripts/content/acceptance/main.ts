import { runMain } from "@effect/platform-node/NodeRuntime";
import { layer } from "@effect/platform-node/NodeServices";
import {
  prepareAcceptance,
  runAcceptance,
} from "@repo/backend/scripts/content/acceptance/build";
import { acceptanceRuntimeError } from "@repo/backend/scripts/content/acceptance/error";
import { createAcceptanceLearner } from "@repo/backend/scripts/content/acceptance/learner";
import { cleanLocalRuntime } from "@repo/backend/scripts/content/acceptance/local";
import { withTerminal } from "@repo/backend/scripts/content/acceptance/process";
import { FetchClient } from "@repo/utilities/http/client";
import { Array as Arr, Effect, FileSystem, Layer, Path } from "effect";

const main = Effect.gen(function* () {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  // The URL derives from this module's own file URL, so it always converts.
  const checkoutPath = yield* path
    .fromFileUrl(new URL("../../../../../", import.meta.url))
    .pipe(Effect.orDie);
  const root = yield* fs.realPath(checkoutPath);
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
  const output = process.argv[3];
  if (mode === "learner" && output !== undefined) {
    return yield* createAcceptanceLearner(root, output);
  }
  return yield* acceptanceRuntimeError(
    "Usage: acceptance <prepare|build|start|clean|learner <cookie-file>>"
  );
});

runMain(
  withTerminal(main).pipe(Effect.provide(Layer.merge(layer, FetchClient)))
);
