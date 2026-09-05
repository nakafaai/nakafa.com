import { createEncryptedArchive } from "@repo/backend/scripts/content/runtime/ci/archive";
import { runConvexData } from "@repo/backend/scripts/content/runtime/ci/command";
import type { ExportConfig } from "@repo/backend/scripts/content/runtime/ci/config";
import { contentRuntimeCiError } from "@repo/backend/scripts/content/runtime/ci/error";
import {
  buildRuntimeGenerations,
  readProductionGenerations,
  verifyRuntimeSelection,
} from "@repo/backend/scripts/content/runtime/ci/generation";
import {
  decodeJsonRows,
  type JsonObject,
} from "@repo/backend/scripts/content/runtime/ci/json";
import { projectActiveRuntime } from "@repo/backend/scripts/content/runtime/ci/projection";
import {
  CONTENT_RUNTIME_CACHE_DIRECTORY,
  CONTENT_RUNTIME_CACHE_FILE,
  createPortableTable,
  formatManifest,
  formatMetadata,
  type ManifestEntry,
} from "@repo/backend/scripts/content/runtime/ci/snapshot";
import {
  CONTENT_RUNTIME_TABLES,
  type RuntimeTable,
  readContentRuntimeSchemaFingerprint,
} from "@repo/backend/scripts/content/runtime/tables";
import { Console, Effect, FileSystem, Redacted } from "effect";

export const exportSignedRuntime = Effect.fn(
  "contentRuntime.exportSignedRuntime"
)((config: ExportConfig) => {
  const cacheRoot = `${config.runnerTemp}/${CONTENT_RUNTIME_CACHE_DIRECTORY}`;
  const encryptedPath = `${cacheRoot}/${CONTENT_RUNTIME_CACHE_FILE}`;

  return Effect.gen(function* () {
    const fileSystem = yield* FileSystem.FileSystem;
    const cacheExists = yield* fileSystem.exists(cacheRoot);
    if (
      cacheExists &&
      (yield* fileSystem.readDirectory(cacheRoot)).length > 0
    ) {
      return yield* contentRuntimeCiError(
        "Signed runtime cache directory must be empty before export."
      );
    }

    yield* verifyRuntimeSelection(
      config,
      yield* readProductionGenerations(config)
    );

    yield* fileSystem.makeDirectory(cacheRoot, { recursive: true });
    yield* fileSystem.chmod(cacheRoot, 0o700);

    const tempRoot = yield* fileSystem.makeTempDirectoryScoped({
      directory: config.runnerTemp,
      prefix: "runtime-export-",
    });
    const gpgHome = `${tempRoot}/gnupg`;
    const snapshotRoot = `${tempRoot}/snapshot`;
    yield* fileSystem.makeDirectory(gpgHome);
    yield* fileSystem.makeDirectory(snapshotRoot);
    yield* fileSystem.chmod(tempRoot, 0o700);
    yield* fileSystem.chmod(gpgHome, 0o700);
    yield* fileSystem.chmod(snapshotRoot, 0o700);

    const deployKey = Redacted.value(config.deployKey);
    const logPath = `${tempRoot}/runtime.log`;
    const entries: ManifestEntry[] = [];
    const source = new Map<RuntimeTable, readonly JsonObject[]>();

    for (const table of CONTENT_RUNTIME_TABLES) {
      const sourcePath = `${tempRoot}/${table}.json`;
      yield* runConvexData({
        deployKey,
        limit: config.exportLimit,
        logPath,
        outputPath: sourcePath,
        table,
      });

      const rows = yield* fileSystem
        .readFileString(sourcePath)
        .pipe(Effect.flatMap(decodeJsonRows));
      if (rows.length >= config.exportLimit) {
        return yield* contentRuntimeCiError(
          `Content runtime table ${table} reached the export limit.`
        );
      }

      source.set(table, rows);
    }

    const projected = yield* projectActiveRuntime(source);
    yield* verifyRuntimeSelection(
      config,
      yield* buildRuntimeGenerations(projected.contentState)
    );
    for (const table of CONTENT_RUNTIME_TABLES) {
      const portable = createPortableTable(table, projected[table]);
      entries.push(portable.entry);
      yield* fileSystem.writeFileString(
        `${snapshotRoot}/${table}.jsonl`,
        portable.jsonLines,
        { mode: 0o600 }
      );
      yield* Console.log(`Exported signed runtime table ${table}.`);
    }

    const identity = {
      runtimeSelectionHash: config.runtimeSelectionHash,
      runtimeSchemaFingerprint: config.runtimeSchemaFingerprint,
    };
    yield* fileSystem.writeFileString(
      `${snapshotRoot}/tables.txt`,
      `${CONTENT_RUNTIME_TABLES.join("\n")}\n`,
      { mode: 0o600 }
    );
    yield* fileSystem.writeFileString(
      `${snapshotRoot}/metadata.json`,
      formatMetadata(identity),
      { mode: 0o600 }
    );
    yield* fileSystem.writeFileString(
      `${snapshotRoot}/manifest.jsonl`,
      formatManifest(entries),
      { mode: 0o600 }
    );

    yield* verifyRuntimeSelection(
      config,
      yield* readProductionGenerations(config)
    );

    yield* createEncryptedArchive({
      archivePath: `${tempRoot}/runtime.tar`,
      cacheKey: Redacted.value(config.cacheKey),
      encryptedPath,
      gpgHome,
      logPath,
      snapshotRoot,
    });

    const cacheEntries = yield* fileSystem.readDirectory(cacheRoot);
    if (
      cacheEntries.length !== 1 ||
      cacheEntries[0] !== CONTENT_RUNTIME_CACHE_FILE
    ) {
      return yield* contentRuntimeCiError(
        "Encrypted signed runtime must be the only cache entry."
      );
    }

    yield* Console.log("Verified stable production runtime selection.");
    const currentSchemaFingerprint =
      yield* readContentRuntimeSchemaFingerprint();
    if (config.runtimeSchemaFingerprint !== currentSchemaFingerprint) {
      return yield* contentRuntimeCiError(
        "Runtime schema fingerprint changed after cache identity creation."
      );
    }
  }).pipe(
    Effect.onError(() =>
      Effect.flatMap(FileSystem.FileSystem, (fileSystem) =>
        fileSystem
          .remove(cacheRoot, { force: true, recursive: true })
          .pipe(Effect.ignore)
      )
    )
  );
});
