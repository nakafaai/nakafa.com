import { runRuntimeCommand } from "@repo/backend/scripts/content/runtime/ci/command";
import { contentRuntimeCiError } from "@repo/backend/scripts/content/runtime/ci/error";
import { validateArchiveListing } from "@repo/backend/scripts/content/runtime/ci/snapshot";
import { Effect, FileSystem } from "effect";

const runGpg = (options: {
  readonly args: readonly string[];
  readonly input?: string;
  readonly logPath: string;
  readonly operation: string;
}) =>
  runRuntimeCommand({
    args: options.args,
    command: "gpg",
    operation: options.operation,
    stderrPath: options.logPath,
    stdin: options.input,
    stdoutPath: options.logPath,
  });

const runTar = (options: {
  readonly args: readonly string[];
  readonly logPath: string;
  readonly operation: string;
  readonly outputPath?: string;
}) =>
  runRuntimeCommand({
    args: options.args,
    command: "tar",
    operation: options.operation,
    stderrPath: options.logPath,
    stdoutPath: options.outputPath ?? options.logPath,
  });

export const createEncryptedArchive = Effect.fn(
  "contentRuntime.createEncryptedArchive"
)(function* (options: {
  readonly archivePath: string;
  readonly cacheKey: string;
  readonly encryptedPath: string;
  readonly gpgHome: string;
  readonly logPath: string;
  readonly snapshotRoot: string;
}) {
  const fileSystem = yield* FileSystem.FileSystem;

  yield* runTar({
    args: [
      "--create",
      "--file",
      options.archivePath,
      "--directory",
      options.snapshotRoot,
      ".",
    ],
    logPath: options.logPath,
    operation: "Signed runtime archive creation",
  });
  yield* fileSystem.chmod(options.archivePath, 0o600);

  yield* runGpg({
    args: [
      "--homedir",
      options.gpgHome,
      "--batch",
      "--yes",
      "--no-symkey-cache",
      "--pinentry-mode",
      "loopback",
      "--symmetric",
      "--cipher-algo",
      "AES256",
      "--force-ocb",
      "--s2k-mode",
      "3",
      "--s2k-digest-algo",
      "SHA512",
      "--compress-algo",
      "zlib",
      "--output",
      options.encryptedPath,
      "--passphrase-fd",
      "0",
      options.archivePath,
    ],
    input: `${options.cacheKey}\n`,
    logPath: options.logPath,
    operation: "Signed runtime authenticated encryption",
  });
  yield* fileSystem.chmod(options.encryptedPath, 0o600);

  yield* runGpg({
    args: [
      "--homedir",
      options.gpgHome,
      "--batch",
      "--yes",
      "--no-symkey-cache",
      "--pinentry-mode",
      "loopback",
      "--list-packets",
      "--passphrase-fd",
      "0",
      options.encryptedPath,
    ],
    input: `${options.cacheKey}\n`,
    logPath: options.logPath,
    operation: "Signed runtime encryption packet verification",
  });
  const packetLog = yield* fileSystem.readFileString(options.logPath);
  if (!packetLog.includes(":aead encrypted packet: cipher=9 aead=2")) {
    return yield* contentRuntimeCiError(
      "Signed runtime archive is not AES256 OCB authenticated encryption."
    );
  }

  const encryptedInfo = yield* fileSystem.stat(options.encryptedPath);
  if (encryptedInfo.type !== "File" || encryptedInfo.size === 0n) {
    return yield* contentRuntimeCiError(
      "Signed runtime encrypted archive is empty."
    );
  }
});

export const decryptAndExtractArchive = Effect.fn(
  "contentRuntime.decryptAndExtractArchive"
)(function* (options: {
  readonly archivePath: string;
  readonly cacheKey: string;
  readonly encryptedPath: string;
  readonly gpgHome: string;
  readonly listingPath: string;
  readonly logPath: string;
  readonly snapshotRoot: string;
  readonly verboseListingPath: string;
}) {
  const fileSystem = yield* FileSystem.FileSystem;

  yield* runGpg({
    args: [
      "--homedir",
      options.gpgHome,
      "--batch",
      "--yes",
      "--no-symkey-cache",
      "--pinentry-mode",
      "loopback",
      "--decrypt",
      "--output",
      options.archivePath,
      "--passphrase-fd",
      "0",
      options.encryptedPath,
    ],
    input: `${options.cacheKey}\n`,
    logPath: options.logPath,
    operation: "Signed runtime authenticated decryption",
  });
  yield* fileSystem.chmod(options.archivePath, 0o600);

  yield* runTar({
    args: ["--list", "--file", options.archivePath],
    logPath: options.logPath,
    operation: "Signed runtime archive listing",
    outputPath: options.listingPath,
  });
  yield* runTar({
    args: ["--list", "--verbose", "--file", options.archivePath],
    logPath: options.logPath,
    operation: "Signed runtime archive type listing",
    outputPath: options.verboseListingPath,
  });
  yield* validateArchiveListing(
    yield* fileSystem.readFileString(options.listingPath),
    yield* fileSystem.readFileString(options.verboseListingPath)
  );

  yield* runTar({
    args: [
      "--extract",
      "--file",
      options.archivePath,
      "--directory",
      options.snapshotRoot,
      "--no-same-owner",
      "--no-same-permissions",
    ],
    logPath: options.logPath,
    operation: "Signed runtime archive extraction",
  });
});
