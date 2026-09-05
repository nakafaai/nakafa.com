import { fileURLToPath } from "node:url";
import * as NodeRuntime from "@effect/platform-node/NodeRuntime";
import * as NodeServices from "@effect/platform-node/NodeServices";
import {
  ContentSnapshotError,
  contentSnapshotError,
} from "@repo/backend/content/snapshot/error";
import { verifyRuntimeSelection } from "@repo/backend/content/snapshot/selection";
import {
  CONTENT_RUNTIME_TABLES,
  readContentRuntimeSchemaFingerprint,
  validateContentRuntimeTableDefinitions,
} from "@repo/backend/content/snapshot/tables";
import {
  buildApplication,
  startApplication,
} from "@repo/backend/scripts/content/runtime/build";
import {
  clearContentRuntimeSecrets,
  readExportConfig,
  readImportConfig,
  readProductionConfig,
  readProductionSelectionConfig,
} from "@repo/backend/scripts/content/runtime/ci/config";
import { exportSignedRuntime } from "@repo/backend/scripts/content/runtime/ci/export";
import {
  formatGenerationEnvironment,
  readProductionGenerations,
} from "@repo/backend/scripts/content/runtime/ci/generation";
import { importRuntimeTables } from "@repo/backend/scripts/content/runtime/ci/import";
import { readSignedRuntime } from "@repo/backend/scripts/content/runtime/ci/read";
import { cleanLocalRuntime } from "@repo/backend/scripts/content/runtime/local";
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
    return yield* contentSnapshotError(
      "Signed runtime must contain safe table names."
    );
  }

  const runnerTemp = yield* Config.nonEmptyString("RUNNER_TEMP");
  const runtimeSchemaFingerprint = yield* readContentRuntimeSchemaFingerprint();
  yield* writeEnvironmentFile(
    runnerTemp,
    FINGERPRINT_ENVIRONMENT_FILE,
    `CONTENT_RUNTIME_SCHEMA_HASH=${runtimeSchemaFingerprint}`
  );
});

const runMode = (mode: string | undefined) => {
  switch (mode) {
    case "build":
    case "prepare":
    case "start":
    case "clean":
      return Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const root = yield* fs.realPath(
          fileURLToPath(new URL("../../../../../../", import.meta.url))
        );
        if (mode === "build" || mode === "prepare") {
          return yield* buildApplication(
            root,
            process.argv.slice(3),
            process.env,
            mode
          );
        }
        if (mode === "start") {
          return yield* startApplication(root, process.argv.slice(3));
        }
        return yield* cleanLocalRuntime(root);
      });
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
        yield* importRuntimeTables(config, yield* readSignedRuntime(config));
      });
    default:
      return Effect.fail(
        contentSnapshotError(
          "Usage: runtime:ci <build|prepare|start|clean|fingerprint|generations|verify-generations|export|import>"
        )
      );
  }
};

const reportFailure = (error: unknown) =>
  Effect.sync(() => {
    const message =
      error instanceof ContentSnapshotError
        ? error.message
        : "Content runtime CI failed.";
    process.stderr.write(`ERROR: ${message}\n`);
  });

const validateTableRegistry = validateContentRuntimeTableDefinitions.pipe(
  Effect.mapError(() =>
    contentSnapshotError(
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
