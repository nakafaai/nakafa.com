import { decodeJsonRows } from "@repo/backend/content/snapshot/json";
import {
  buildRuntimeGenerations,
  type RuntimeGenerations,
} from "@repo/backend/content/snapshot/selection";
import { runConvexData } from "@repo/backend/scripts/content/runtime/ci/command";
import type { ProductionConfig } from "@repo/backend/scripts/content/runtime/ci/config";
import { Effect, FileSystem, Redacted } from "effect";
/** Reads the exact current signed pointer from production. */
export const readProductionGenerations = Effect.fn(
  "contentRuntime.readProductionGenerations"
)(function* (config: ProductionConfig) {
  const fileSystem = yield* FileSystem.FileSystem;
  const tempRoot = yield* fileSystem.makeTempDirectoryScoped({
    directory: config.runnerTemp,
    prefix: "runtime-state-",
  });
  yield* fileSystem.chmod(tempRoot, 0o700);
  const deployKey = Redacted.value(config.deployKey);
  const contentStatePath = `${tempRoot}/content-state.json`;
  yield* runConvexData({
    deployKey,
    limit: 2,
    logPath: `${tempRoot}/content-state.log`,
    outputPath: contentStatePath,
    table: "contentState",
  });
  const contentState = yield* fileSystem
    .readFileString(contentStatePath)
    .pipe(Effect.flatMap(decodeJsonRows));
  return yield* buildRuntimeGenerations(contentState);
});
export const formatGenerationEnvironment = (generations: RuntimeGenerations) =>
  `CONTENT_RUNTIME_SELECTION_HASH=${generations.runtimeSelectionHash}`;
