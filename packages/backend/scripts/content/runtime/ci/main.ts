import * as NodeRuntime from "@effect/platform-node/NodeRuntime";
import * as NodeServices from "@effect/platform-node/NodeServices";
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
import {
  CONTENT_RUNTIME_SCHEMA_FINGERPRINT,
  CONTENT_RUNTIME_TABLES,
  validateContentRuntimeTableDefinitions,
} from "@repo/backend/scripts/content/runtime/tables";
import { Config, ConfigProvider, Effect, FileSystem } from "effect";

const INVALID_TABLE_NAME = /[^A-Za-z0-9_]/;
const FINGERPRINT_ENVIRONMENT_FILE = "runtime-schema.env";
const GENERATION_ENVIRONMENT_FILE = "runtime-state.env";

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

const writeFingerprintEnvironment = Effect.gen(function* () {
  if (
    CONTENT_RUNTIME_TABLES.length === 0 ||
    CONTENT_RUNTIME_TABLES.some(
      (table) => table.length === 0 || INVALID_TABLE_NAME.test(table)
    )
  ) {
    return yield* contentRuntimeCiError(
      "Signed runtime must contain safe table names."
    );
  }

  const runnerTemp = yield* Config.nonEmptyString("RUNNER_TEMP");
  yield* writeEnvironmentFile(
    runnerTemp,
    FINGERPRINT_ENVIRONMENT_FILE,
    `CONTENT_RUNTIME_SCHEMA_HASH=${CONTENT_RUNTIME_SCHEMA_FINGERPRINT}`
  );
});

const runMode = (mode: string | undefined) => {
  switch (mode) {
    case "fingerprint":
      return writeFingerprintEnvironment;
    case "generations":
      return Effect.gen(function* () {
        const config = yield* readProductionConfig;
        yield* clearContentRuntimeSecrets;
        yield* writeEnvironmentFile(
          config.runnerTemp,
          GENERATION_ENVIRONMENT_FILE,
          formatGenerationEnvironment(yield* readProductionGenerations(config))
        );
      });
    case "verify-generations":
      return Effect.gen(function* () {
        const config = yield* readProductionSelectionConfig;
        yield* clearContentRuntimeSecrets;
        yield* verifyRuntimeSelection(
          config,
          yield* readProductionGenerations(config)
        );
      });
    case "export":
      return Effect.gen(function* () {
        const config = yield* readExportConfig;
        yield* clearContentRuntimeSecrets;
        yield* exportSignedRuntime(config);
      });
    case "import":
      return Effect.gen(function* () {
        const config = yield* readImportConfig;
        yield* clearContentRuntimeSecrets;
        yield* importSignedRuntime(config);
      });
    default:
      return Effect.fail(
        contentRuntimeCiError(
          "Usage: runtime:ci <fingerprint|generations|verify-generations|export|import>"
        )
      );
  }
};

const reportFailure = (error: unknown) =>
  Effect.sync(() => {
    const message =
      error instanceof ContentRuntimeCiError
        ? error.message
        : "Content runtime CI failed.";
    process.stderr.write(`ERROR: ${message}\n`);
  });

const validateTableRegistry = validateContentRuntimeTableDefinitions.pipe(
  Effect.mapError(() =>
    contentRuntimeCiError(
      "Signed runtime table registry contains a duplicate name."
    )
  )
);

const main = Effect.gen(function* () {
  yield* validateTableRegistry;
  yield* runMode(process.argv[2]);
}).pipe(
  Effect.ensuring(clearContentRuntimeSecrets),
  Effect.tapError(reportFailure),
  Effect.scoped,
  Effect.provide(NodeServices.layer),
  Effect.provideService(
    ConfigProvider.ConfigProvider,
    ConfigProvider.fromEnvRecord(process.env)
  )
);

NodeRuntime.runMain(main, { disableErrorReporting: true });
