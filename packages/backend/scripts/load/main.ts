import { runMain } from "@effect/platform-node/NodeRuntime";
import { layer } from "@effect/platform-node/NodeServices";
import { withTerminal } from "@repo/backend/scripts/content/acceptance/terminal";
import { runLoadCommand } from "@repo/backend/scripts/load/command";
import { FetchClient } from "@repo/utilities/http/client";
import { Array as Arr, Effect, FileSystem, Layer } from "effect";

/**
 * Runs the load test that the command line names (`bun run load <report-file> [students]
 * [minutes]`) from the repository root. Bun runs it, because the students call the sittings
 * through the Confect contracts, whose generated modules Node cannot resolve.
 */
const main = Effect.gen(function* () {
  const fs = yield* FileSystem.FileSystem;
  const root = yield* fs.realPath(`${import.meta.dirname}/../../../..`);
  return yield* runLoadCommand(root, Arr.drop(process.argv, 2));
});

runMain(
  withTerminal(main).pipe(Effect.provide(Layer.merge(layer, FetchClient)))
);
