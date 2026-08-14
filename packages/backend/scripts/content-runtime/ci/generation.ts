import { FileSystem } from "@effect/platform";
import { Effect, Redacted } from "effect";
import { runConvexData } from "./command";
import type { CacheIdentity, ProductionConfig } from "./config";
import { contentRuntimeCiError } from "./error";
import {
  decodeJsonRows,
  hashCanonicalJson,
  type JsonObject,
  stripConvexSystemFields,
} from "./json";

export interface RuntimeGenerations {
  readonly contentStateHash: string;
}

/** Proves the production generation did not change during the CI run. */
export const verifyRuntimeGenerations = (
  expected: CacheIdentity,
  actual: RuntimeGenerations
) => {
  if (expected.contentStateHash === actual.contentStateHash) {
    return Effect.void;
  }

  return Effect.fail(
    contentRuntimeCiError(
      "Production signed content pointer changed during runtime verification."
    )
  );
};

/** Builds the sole mutable generation identity from the signed pointer row. */
export const buildRuntimeGenerations = Effect.fn(
  "contentRuntime.buildGenerations"
)(function* (contentState: readonly JsonObject[]) {
  if (contentState.length !== 1) {
    return yield* contentRuntimeCiError(
      "Production contentState must contain exactly one row."
    );
  }

  const activePointer = contentState[0];
  if (!activePointer) {
    return yield* contentRuntimeCiError(
      "Production contentState must contain exactly one row."
    );
  }

  return {
    contentStateHash: yield* hashCanonicalJson(
      stripConvexSystemFields(activePointer)
    ),
  } satisfies RuntimeGenerations;
});

/** Reads the exact current signed pointer from production. */
export const readProductionGenerations = Effect.fn(
  "contentRuntime.readProductionGenerations"
)(function* (config: ProductionConfig) {
  const fileSystem = yield* FileSystem.FileSystem;
  const tempRoot = yield* fileSystem.makeTempDirectoryScoped({
    directory: config.runnerTemp,
    prefix: "agent-docs-generations-",
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
  `AGENT_DOCS_CONTENT_STATE_HASH=${generations.contentStateHash}`;
