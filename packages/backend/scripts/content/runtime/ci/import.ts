import { decryptAndExtractArchive } from "@repo/backend/scripts/content/runtime/ci/archive";
import { runConvexImport } from "@repo/backend/scripts/content/runtime/ci/command";
import type { ImportConfig } from "@repo/backend/scripts/content/runtime/ci/config";
import { contentRuntimeCiError } from "@repo/backend/scripts/content/runtime/ci/error";
import {
  CONTENT_RUNTIME_CACHE_DIRECTORY,
  CONTENT_RUNTIME_CACHE_FILE,
  decodeAndValidateManifest,
  validateMetadata,
  validatePortableTable,
} from "@repo/backend/scripts/content/runtime/ci/snapshot";
import { CONTENT_RUNTIME_TABLES } from "@repo/backend/scripts/content/runtime/tables";
import { Console, Effect, FileSystem, Redacted } from "effect";

export const importSignedRuntime = Effect.fn(
  "contentRuntime.importSignedRuntime"
)(function* (config: ImportConfig) {
  const fileSystem = yield* FileSystem.FileSystem;
  const encryptedPath = `${config.runnerTemp}/${CONTENT_RUNTIME_CACHE_DIRECTORY}/${CONTENT_RUNTIME_CACHE_FILE}`;
  const encryptedInfo = yield* fileSystem.stat(encryptedPath);
  if (encryptedInfo.type !== "File" || encryptedInfo.size === 0n) {
    return yield* contentRuntimeCiError(
      "Encrypted signed runtime cache is missing."
    );
  }

  const tempRoot = yield* fileSystem.makeTempDirectoryScoped({
    directory: config.runnerTemp,
    prefix: "agent-docs-import-",
  });
  const gpgHome = `${tempRoot}/gnupg`;
  const snapshotRoot = `${tempRoot}/snapshot`;
  yield* fileSystem.makeDirectory(gpgHome);
  yield* fileSystem.makeDirectory(snapshotRoot);
  yield* fileSystem.chmod(tempRoot, 0o700);
  yield* fileSystem.chmod(gpgHome, 0o700);
  yield* fileSystem.chmod(snapshotRoot, 0o700);

  const logPath = `${tempRoot}/runtime.log`;
  yield* decryptAndExtractArchive({
    archivePath: `${tempRoot}/runtime.tar`,
    cacheKey: Redacted.value(config.cacheKey),
    encryptedPath,
    gpgHome,
    listingPath: `${tempRoot}/archive.txt`,
    logPath,
    snapshotRoot,
    verboseListingPath: `${tempRoot}/archive-verbose.txt`,
  });

  yield* validateMetadata(
    yield* fileSystem.readFileString(`${snapshotRoot}/metadata.json`),
    {
      contentStateHash: config.contentStateHash,
      runtimeSchemaFingerprint: config.runtimeSchemaFingerprint,
    }
  );

  const expectedTables = `${CONTENT_RUNTIME_TABLES.join("\n")}\n`;
  const actualTables = yield* fileSystem.readFileString(
    `${snapshotRoot}/tables.txt`
  );
  if (actualTables !== expectedTables) {
    return yield* contentRuntimeCiError(
      "Signed runtime table set does not match the runtime contract."
    );
  }

  const manifest = yield* decodeAndValidateManifest(
    yield* fileSystem.readFileString(`${snapshotRoot}/manifest.jsonl`)
  );
  for (const entry of manifest) {
    yield* validatePortableTable(
      entry,
      yield* fileSystem.readFileString(`${snapshotRoot}/${entry.table}.jsonl`)
    );
  }

  for (const entry of manifest) {
    yield* runConvexImport({
      inputPath: `${snapshotRoot}/${entry.table}.jsonl`,
      logPath,
      table: entry.table,
    });
    yield* Console.log(`Imported signed runtime table ${entry.table}.`);
  }
});
