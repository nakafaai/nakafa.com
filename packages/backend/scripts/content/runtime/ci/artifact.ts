import { randomUUID } from "node:crypto";
import { MAX_CONTENT_RUNTIME_ARCHIVE_BYTES } from "@repo/backend/content/archive";
import type {
  RuntimeArchiveReadConfig,
  RuntimeArchiveWriteConfig,
} from "@repo/backend/scripts/content/runtime/ci/access";
import { contentRuntimeCiError } from "@repo/backend/scripts/content/runtime/ci/error";
import { storeRuntimeArchive } from "@repo/backend/scripts/content/runtime/ci/publish";
import { fetchRuntimeArchive } from "@repo/backend/scripts/content/runtime/ci/remote";
import {
  CONTENT_RUNTIME_CACHE_DIRECTORY,
  CONTENT_RUNTIME_CACHE_FILE,
} from "@repo/backend/scripts/content/runtime/ci/snapshot";
import { Effect, FileSystem, Option } from "effect";

export const CONTENT_RUNTIME_STATE_FILE = "runtime-state.env";

function encryptedArchivePath(config: { readonly runnerTemp: string }) {
  return `${config.runnerTemp}/${CONTENT_RUNTIME_CACHE_DIRECTORY}/${CONTENT_RUNTIME_CACHE_FILE}`;
}

/** Uploads and immutably binds the locally encrypted runtime archive. */
export const publishRuntimeArchive = Effect.fn(
  "contentRuntimeArtifact.publish"
)(function* (
  config: RuntimeArchiveWriteConfig & { readonly contentStateHash: string },
  claimId: string,
  fetcher: typeof fetch
) {
  const fileSystem = yield* FileSystem.FileSystem;
  const path = encryptedArchivePath(config);
  if (!(yield* fileSystem.exists(path))) {
    return yield* contentRuntimeCiError(
      "Encrypted signed runtime archive is missing before publication."
    );
  }
  const info = yield* fileSystem.stat(path);
  if (info.type !== "File" || info.size <= 0n) {
    return yield* contentRuntimeCiError(
      "Encrypted signed runtime archive is missing before publication."
    );
  }
  if (info.size > BigInt(MAX_CONTENT_RUNTIME_ARCHIVE_BYTES)) {
    return yield* contentRuntimeCiError(
      `Encrypted signed runtime archive exceeds ${MAX_CONTENT_RUNTIME_ARCHIVE_BYTES} bytes.`
    );
  }
  return yield* storeRuntimeArchive(
    config,
    claimId,
    yield* fileSystem.readFile(path),
    fetcher
  );
});

/** Downloads one verified archive into an empty private cache directory. */
export const downloadRuntimeArchive = Effect.fn(
  "contentRuntimeArtifact.download"
)(function* (config: RuntimeArchiveReadConfig, fetcher: typeof fetch) {
  const fileSystem = yield* FileSystem.FileSystem;
  const cacheRoot = `${config.runnerTemp}/${CONTENT_RUNTIME_CACHE_DIRECTORY}`;
  const statePath = `${config.runnerTemp}/${CONTENT_RUNTIME_STATE_FILE}`;
  if (
    (yield* fileSystem.exists(cacheRoot)) &&
    (yield* fileSystem.readDirectory(cacheRoot)).length > 0
  ) {
    return yield* contentRuntimeCiError(
      "Signed runtime cache directory must be empty before download."
    );
  }
  const archive = yield* fetchRuntimeArchive(config, fetcher);
  if (Option.isNone(archive)) {
    return yield* contentRuntimeCiError(
      "Immutable signed runtime archive is not available."
    );
  }
  const { bytes, metadata } = archive.value;
  yield* fileSystem.makeDirectory(cacheRoot, { recursive: true });
  yield* fileSystem.chmod(cacheRoot, 0o700);
  yield* Effect.acquireUseRelease(
    Effect.succeed({
      archive: `${cacheRoot}/.${CONTENT_RUNTIME_CACHE_FILE}.${randomUUID()}.tmp`,
      state: `${config.runnerTemp}/.${CONTENT_RUNTIME_STATE_FILE}.${randomUUID()}.tmp`,
    }),
    (temporary) =>
      Effect.gen(function* () {
        yield* fileSystem.writeFile(temporary.archive, bytes, { mode: 0o600 });
        yield* fileSystem.writeFileString(
          temporary.state,
          `CONTENT_RUNTIME_STATE_HASH=${metadata.sourceStateHash}\n`,
          { mode: 0o600 }
        );
        yield* fileSystem.rename(
          temporary.archive,
          encryptedArchivePath(config)
        );
        yield* fileSystem
          .rename(temporary.state, statePath)
          .pipe(
            Effect.onError(() =>
              fileSystem
                .remove(encryptedArchivePath(config), { force: true })
                .pipe(Effect.ignore)
            )
          );
      }),
    (temporary) =>
      Effect.all([
        fileSystem.remove(temporary.archive, { force: true }),
        fileSystem.remove(temporary.state, { force: true }),
      ])
  );
  return metadata;
});
