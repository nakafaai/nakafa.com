import * as NodeRuntime from "@effect/platform-node/NodeRuntime";
import * as NodeServices from "@effect/platform-node/NodeServices";
import {
  clearRuntimeArchiveSecrets,
  readProducerConfig,
  readRuntimeArchiveAccessConfig,
} from "@repo/backend/scripts/content/runtime/ci/access";
import { downloadRuntimeArchive } from "@repo/backend/scripts/content/runtime/ci/artifact";
import {
  clearContentRuntimeSecrets,
  readExportConfig,
  readImportConfig,
  readProductionConfig,
  readProductionSelectionConfig,
} from "@repo/backend/scripts/content/runtime/ci/config";
import {
  ContentRuntimeCiError,
  contentRuntimeCiError,
} from "@repo/backend/scripts/content/runtime/ci/error";
import { exportSignedRuntime } from "@repo/backend/scripts/content/runtime/ci/export";
import {
  formatGenerationEnvironment,
  readProductionGenerations,
  verifyRuntimeSelection,
} from "@repo/backend/scripts/content/runtime/ci/generation";
import { importSignedRuntime } from "@repo/backend/scripts/content/runtime/ci/import";
import { produceRuntimeArchive } from "@repo/backend/scripts/content/runtime/ci/producer";
import {
  CONTENT_RUNTIME_TABLES,
  readContentRuntimeSchemaFingerprint,
  validateContentRuntimeTableDefinitions,
} from "@repo/backend/scripts/content/runtime/tables";
import { Config, ConfigProvider, Effect, FileSystem } from "effect";

const INVALID_TABLE_NAME = /[^A-Za-z0-9_]/;
const FINGERPRINT_ENVIRONMENT_FILE = "runtime-schema.env";
const GENERATION_ENVIRONMENT_FILE = "runtime-state.env";

export interface RuntimeCiOperations {
  readonly clearArchiveSecrets: typeof clearRuntimeArchiveSecrets;
  readonly clearContentSecrets: typeof clearContentRuntimeSecrets;
  readonly download: typeof downloadRuntimeArchive;
  readonly exportRuntime: typeof exportSignedRuntime;
  readonly fetcher: typeof fetch;
  readonly importRuntime: typeof importSignedRuntime;
  readonly produce: typeof produceRuntimeArchive;
  readonly readExport: typeof readExportConfig;
  readonly readGenerations: typeof readProductionGenerations;
  readonly readImport: typeof readImportConfig;
  readonly readProducer: typeof readProducerConfig;
  readonly readProduction: typeof readProductionConfig;
  readonly readRuntimeArchive: typeof readRuntimeArchiveAccessConfig;
  readonly readSchemaFingerprint: typeof readContentRuntimeSchemaFingerprint;
  readonly readSelection: typeof readProductionSelectionConfig;
  readonly runtimeTables: readonly string[];
  readonly validateRegistry: typeof validateContentRuntimeTableDefinitions;
  readonly verifySelection: typeof verifyRuntimeSelection;
}

const liveOperations: RuntimeCiOperations = {
  clearArchiveSecrets: clearRuntimeArchiveSecrets,
  clearContentSecrets: clearContentRuntimeSecrets,
  download: downloadRuntimeArchive,
  exportRuntime: exportSignedRuntime,
  fetcher: fetch,
  importRuntime: importSignedRuntime,
  produce: produceRuntimeArchive,
  readExport: readExportConfig,
  readGenerations: readProductionGenerations,
  readImport: readImportConfig,
  readProducer: readProducerConfig,
  readProduction: readProductionConfig,
  readRuntimeArchive: readRuntimeArchiveAccessConfig,
  readSchemaFingerprint: readContentRuntimeSchemaFingerprint,
  readSelection: readProductionSelectionConfig,
  runtimeTables: CONTENT_RUNTIME_TABLES,
  validateRegistry: validateContentRuntimeTableDefinitions,
  verifySelection: verifyRuntimeSelection,
};

const writeEnvironmentFile = Effect.fn("contentRuntime.writeEnvironmentFile")(
  function* (runnerTemp: string, fileName: string, content: string) {
    const fileSystem = yield* FileSystem.FileSystem;
    yield* fileSystem.writeFileString(
      `${runnerTemp}/${fileName}`,
      `${content}\n`,
      { mode: 0o600 }
    );
  }
);

const writeFingerprintEnvironment = (operations: RuntimeCiOperations) =>
  Effect.gen(function* () {
    if (
      operations.runtimeTables.length === 0 ||
      operations.runtimeTables.some(
        (table) => table.length === 0 || INVALID_TABLE_NAME.test(table)
      )
    ) {
      return yield* contentRuntimeCiError(
        "Signed runtime must contain safe table names."
      );
    }

    const runnerTemp = yield* Config.nonEmptyString("RUNNER_TEMP");
    const runtimeSchemaFingerprint = yield* operations.readSchemaFingerprint();
    yield* writeEnvironmentFile(
      runnerTemp,
      FINGERPRINT_ENVIRONMENT_FILE,
      `CONTENT_RUNTIME_SCHEMA_HASH=${runtimeSchemaFingerprint}`
    );
  });

const runMode = (mode: string | undefined, operations: RuntimeCiOperations) => {
  switch (mode) {
    case "fingerprint":
      return writeFingerprintEnvironment(operations);
    case "generations":
      return Effect.gen(function* () {
        const config = yield* operations.readProduction;
        yield* operations.clearContentSecrets;
        yield* writeEnvironmentFile(
          config.runnerTemp,
          GENERATION_ENVIRONMENT_FILE,
          formatGenerationEnvironment(yield* operations.readGenerations(config))
        );
      });
    case "verify-generations":
      return Effect.gen(function* () {
        const config = yield* operations.readSelection;
        yield* operations.clearContentSecrets;
        yield* operations.verifySelection(
          config,
          yield* operations.readGenerations(config)
        );
      });
    case "export":
      return Effect.gen(function* () {
        const config = yield* operations.readExport;
        yield* operations.clearContentSecrets;
        yield* operations.exportRuntime(config);
      });
    case "import":
      return Effect.gen(function* () {
        const config = yield* operations.readImport;
        yield* operations.clearContentSecrets;
        yield* operations.importRuntime(config);
      });
    case "produce":
      return Effect.gen(function* () {
        const config = yield* operations.readProducer;
        yield* operations.clearContentSecrets;
        yield* operations.clearArchiveSecrets;
        yield* operations.produce(
          config,
          operations.fetcher,
          operations.exportRuntime
        );
      });
    case "download":
      return Effect.gen(function* () {
        const config = yield* operations.readRuntimeArchive;
        yield* operations.clearContentSecrets;
        yield* operations.clearArchiveSecrets;
        yield* operations.download(config, operations.fetcher);
      });
    default:
      return Effect.fail(
        contentRuntimeCiError(
          "Usage: runtime:ci <fingerprint|generations|verify-generations|export|import|produce|download>"
        )
      );
  }
};

export const reportRuntimeCiFailure = (error: unknown) =>
  Effect.sync(() => {
    const message =
      error instanceof ContentRuntimeCiError
        ? error.message
        : "Content runtime CI failed.";
    process.stderr.write(`ERROR: ${message}\n`);
  });

export function makeRuntimeCiProgram(
  mode: string | undefined,
  operations: RuntimeCiOperations
) {
  const validateTableRegistry = operations.validateRegistry.pipe(
    Effect.mapError(() =>
      contentRuntimeCiError(
        "Signed runtime table registry contains a duplicate name."
      )
    )
  );

  return Effect.gen(function* () {
    yield* validateTableRegistry;
    yield* runMode(mode, operations);
  }).pipe(
    Effect.ensuring(operations.clearContentSecrets),
    Effect.ensuring(operations.clearArchiveSecrets),
    Effect.tapError(reportRuntimeCiFailure),
    Effect.scoped,
    Effect.provide(NodeServices.layer),
    Effect.provideService(
      ConfigProvider.ConfigProvider,
      ConfigProvider.fromEnvRecord(process.env)
    )
  );
}

const main = makeRuntimeCiProgram(process.argv[2], liveOperations);

NodeRuntime.runMain(main, { disableErrorReporting: true });
