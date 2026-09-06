import { fileURLToPath } from "node:url";
import { runMain } from "@effect/platform-node/NodeRuntime";
import { layer } from "@effect/platform-node/NodeServices";
import {
  prepareAcceptance,
  runAcceptance,
} from "@repo/backend/scripts/content/acceptance/build";
import { acceptanceRuntimeError } from "@repo/backend/scripts/content/acceptance/error";
import { cleanLocalRuntime } from "@repo/backend/scripts/content/acceptance/local";
import { Effect, FileSystem } from "effect";

const main = Effect.gen(function* () {
  const fs = yield* FileSystem.FileSystem;
  const root = yield* fs.realPath(
    fileURLToPath(new URL("../../../../../", import.meta.url))
  );
  const mode = process.argv[2];
  if (mode === "prepare") {
    return yield* prepareAcceptance(root);
  }
  if (mode === "build" || mode === "start") {
    return yield* runAcceptance(root, mode, process.argv.slice(3));
  }
  if (mode === "clean") {
    return yield* cleanLocalRuntime(root);
  }
  return yield* acceptanceRuntimeError(
    "Usage: acceptance <prepare|build|start|clean>"
  );
});

runMain(main.pipe(Effect.scoped, Effect.provide(layer)));
