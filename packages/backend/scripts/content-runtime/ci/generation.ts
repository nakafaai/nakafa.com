import { FileSystem } from "@effect/platform";
import { Effect, Redacted } from "effect";
import { runConvexData } from "./command";
import type { ProductionConfig, RuntimeGenerationIdentity } from "./config";
import { contentRuntimeCiError } from "./error";
import {
  decodeJsonRows,
  hashCanonicalJson,
  type JsonObject,
  stripConvexSystemFields,
} from "./json";
import { verifyProvedMaintenance } from "./maintenance";

interface PublishedRuntimeGenerations {
  readonly contentStateHash: string;
  readonly mode: "published";
  readonly runtimeGenerationHash: string;
}

interface MaintenanceRuntimeGenerations {
  readonly mode: "proved-maintenance";
  readonly runtimeGenerationHash: string;
}

export type RuntimeGenerations =
  | MaintenanceRuntimeGenerations
  | PublishedRuntimeGenerations;

/** Proves the production generation did not change during the CI run. */
export const verifyRuntimeGenerations = (
  expected: RuntimeGenerationIdentity,
  actual: RuntimeGenerations
) => {
  if (
    expected.runtimeMode === actual.mode &&
    expected.runtimeGenerationHash === actual.runtimeGenerationHash
  ) {
    return Effect.void;
  }

  return Effect.fail(
    contentRuntimeCiError(
      "Production content generation changed during runtime verification."
    )
  );
};

/** Selects the normal signed pointer or the exact proved-maintenance receipt. */
export const buildRuntimeGenerations = Effect.fn(
  "contentRuntime.buildGenerations"
)(function* (
  contentState: readonly JsonObject[],
  contentCutoverState: readonly JsonObject[] = [],
  contentCutoverActivity: readonly JsonObject[] = []
) {
  if (contentState.length > 1) {
    return yield* contentRuntimeCiError(
      "Production contentState must contain at most one row."
    );
  }

  const activePointer = contentState[0];
  if (activePointer) {
    const contentStateHash = yield* hashCanonicalJson(
      stripConvexSystemFields(activePointer)
    );
    return {
      contentStateHash,
      mode: "published",
      runtimeGenerationHash: contentStateHash,
    } satisfies RuntimeGenerations;
  }

  const maintenance = yield* verifyProvedMaintenance({
    contentCutoverActivity,
    contentCutoverState,
    contentState,
  });
  return {
    mode: "proved-maintenance",
    runtimeGenerationHash: yield* hashCanonicalJson({
      contentCutoverActivity: maintenance.contentCutoverActivity.map(
        stripConvexSystemFields
      ),
      contentCutoverState: maintenance.contentCutoverState.map(
        stripConvexSystemFields
      ),
      contentState: [],
    }),
  } satisfies RuntimeGenerations;
});

/** Reads the current publication or proved-maintenance generation. */
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
  if (contentState.length > 0) {
    return yield* buildRuntimeGenerations(contentState);
  }

  const cutoverStatePath = `${tempRoot}/content-cutover-state.json`;
  const cutoverActivityPath = `${tempRoot}/content-cutover-activity.json`;
  yield* runConvexData({
    deployKey,
    limit: 2,
    logPath: `${tempRoot}/content-cutover-state.log`,
    outputPath: cutoverStatePath,
    table: "contentCutoverState",
  });
  yield* runConvexData({
    deployKey,
    limit: 2,
    logPath: `${tempRoot}/content-cutover-activity.log`,
    outputPath: cutoverActivityPath,
    table: "contentCutoverActivity",
  });

  const [contentCutoverState, contentCutoverActivity] = yield* Effect.all([
    fileSystem
      .readFileString(cutoverStatePath)
      .pipe(Effect.flatMap(decodeJsonRows)),
    fileSystem
      .readFileString(cutoverActivityPath)
      .pipe(Effect.flatMap(decodeJsonRows)),
  ]);
  return yield* buildRuntimeGenerations(
    contentState,
    contentCutoverState,
    contentCutoverActivity
  );
});

export const formatGenerationEnvironment = (generations: RuntimeGenerations) =>
  [
    `AGENT_DOCS_CONTENT_RUNTIME_MODE=${generations.mode}`,
    `AGENT_DOCS_RUNTIME_GENERATION_HASH=${generations.runtimeGenerationHash}`,
    ...(generations.mode === "published"
      ? [`AGENT_DOCS_CONTENT_STATE_HASH=${generations.contentStateHash}`]
      : []),
  ].join("\n");
