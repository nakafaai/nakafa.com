import * as NodeServices from "@effect/platform-node/NodeServices";
import { describe, expect, it } from "@effect/vitest";
import { CONTENT_RUNTIME_TABLES } from "@repo/backend/content/snapshot/tables";
import {
  createEncryptedArchive,
  decryptAndExtractArchive,
} from "@repo/backend/scripts/content/runtime/ci/archive";
import * as commands from "@repo/backend/scripts/content/runtime/ci/command";
import { Effect, FileSystem } from "effect";

const CACHE_KEY = "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGH";
const runCommand = commands.runRuntimeCommand;

const makeFixture = Effect.fn("ArchiveTest.makeFixture")(function* () {
  const fileSystem = yield* FileSystem.FileSystem;
  const root = yield* fileSystem.makeTempDirectoryScoped({
    directory: "/tmp",
    prefix: "content-runtime-archive-test-",
  });
  const snapshotRoot = `${root}/snapshot`;
  const gpgHome = `${root}/gnupg`;
  for (const directory of [snapshotRoot, gpgHome]) {
    yield* fileSystem.makeDirectory(directory);
    yield* fileSystem.chmod(directory, 0o700);
  }
  yield* fileSystem.writeFileString(`${snapshotRoot}/metadata.json`, "{}\n");
  return {
    archivePath: `${root}/runtime.tar`,
    cacheKey: CACHE_KEY,
    encryptedPath: `${root}/runtime.tar.gpg`,
    gpgHome,
    logPath: `${root}/runtime.log`,
    snapshotRoot,
  };
});

describe("content runtime archive", () => {
  it.live("rejects archives without the required authenticated cipher", () =>
    Effect.gen(function* () {
      const fixture = yield* makeFixture();
      const command = vi
        .spyOn(commands, "runRuntimeCommand")
        .mockImplementation((spec) =>
          runCommand({
            ...spec,
            args: spec.args.map((arg) =>
              arg === "--force-aead" ? "--rfc4880" : arg
            ),
          })
        );
      const failure = yield* createEncryptedArchive(fixture).pipe(
        Effect.flip,
        Effect.ensuring(Effect.sync(() => command.mockRestore()))
      );
      expect(failure).toMatchObject({
        _tag: "ContentSnapshotError",
        message:
          "Signed runtime archive is not AES256 OCB authenticated encryption.",
      });
    }).pipe(Effect.scoped, Effect.provide(NodeServices.layer))
  );

  for (const replacement of ["empty", "directory"]) {
    it.live(
      `rejects ciphertext replaced by an ${replacement} after verification`,
      () =>
        Effect.gen(function* () {
          const fileSystem = yield* FileSystem.FileSystem;
          const fixture = yield* makeFixture();
          const command = vi
            .spyOn(commands, "runRuntimeCommand")
            .mockImplementation((spec) =>
              runCommand(spec).pipe(
                Effect.tap(() =>
                  spec.args.includes("--list-packets")
                    ? Effect.gen(function* () {
                        yield* fileSystem.remove(fixture.encryptedPath);
                        if (replacement === "empty") {
                          yield* fileSystem.writeFileString(
                            fixture.encryptedPath,
                            ""
                          );
                        } else {
                          yield* fileSystem.makeDirectory(
                            fixture.encryptedPath
                          );
                        }
                      })
                    : Effect.void
                )
              )
            );
          const failure = yield* createEncryptedArchive(fixture).pipe(
            Effect.flip,
            Effect.ensuring(Effect.sync(() => command.mockRestore()))
          );
          expect(failure).toMatchObject({
            _tag: "ContentSnapshotError",
            message: "Signed runtime encrypted archive is empty.",
          });
        }).pipe(Effect.scoped, Effect.provide(NodeServices.layer))
    );
  }

  it.live("reports command failures without exposing the passphrase", () =>
    Effect.gen(function* () {
      const fixture = yield* makeFixture();
      const command = vi
        .spyOn(commands, "runRuntimeCommand")
        .mockImplementation((spec) =>
          runCommand(
            spec.command === "gpg"
              ? {
                  ...spec,
                  command: "sh",
                  args: [
                    "-c",
                    "read -r value; printf 'unsupported encryption: %s' \"$value\"; exit 2",
                  ],
                }
              : spec
          )
        );
      const failure = yield* createEncryptedArchive(fixture).pipe(
        Effect.flip,
        Effect.ensuring(Effect.sync(() => command.mockRestore()))
      );
      expect(failure).toMatchObject({
        _tag: "ContentSnapshotError",
        message:
          "Signed runtime authenticated encryption failed: unsupported encryption: [redacted]",
      });
      expect(JSON.stringify(failure)).not.toContain(CACHE_KEY);
    }).pipe(Effect.scoped, Effect.provide(NodeServices.layer))
  );

  it.live(
    "uses OCB authenticated encryption and rejects ciphertext tampering",
    () =>
      Effect.gen(function* () {
        const failure = yield* Effect.scoped(
          Effect.gen(function* () {
            const fileSystem = yield* FileSystem.FileSystem;
            const root = yield* fileSystem.makeTempDirectoryScoped({
              directory: "/tmp",
              prefix: "content-runtime-archive-test-",
            });
            const encryptedPath = `${root}/runtime.tar.gpg`;
            const exportGpgHome = `${root}/export-gnupg`;
            const importGpgHome = `${root}/import-gnupg`;
            const extractedRoot = `${root}/extracted`;
            const snapshotRoot = `${root}/snapshot`;
            for (const directory of [
              exportGpgHome,
              importGpgHome,
              extractedRoot,
              snapshotRoot,
            ]) {
              yield* fileSystem.makeDirectory(directory);
              yield* fileSystem.chmod(directory, 0o700);
            }
            yield* fileSystem.writeFileString(
              `${snapshotRoot}/manifest.jsonl`,
              ""
            );
            yield* fileSystem.writeFileString(
              `${snapshotRoot}/metadata.json`,
              "{}\n"
            );
            yield* fileSystem.writeFileString(
              `${snapshotRoot}/tables.txt`,
              `${CONTENT_RUNTIME_TABLES.join("\n")}\n`
            );
            yield* Effect.forEach(CONTENT_RUNTIME_TABLES, (table) =>
              fileSystem.writeFileString(`${snapshotRoot}/${table}.jsonl`, "")
            );
            yield* createEncryptedArchive({
              archivePath: `${root}/runtime.tar`,
              cacheKey: CACHE_KEY,
              encryptedPath,
              gpgHome: exportGpgHome,
              logPath: `${root}/export.log`,
              snapshotRoot,
            });
            yield* decryptAndExtractArchive({
              archivePath: `${root}/decrypted.tar`,
              cacheKey: CACHE_KEY,
              encryptedPath,
              gpgHome: importGpgHome,
              listingPath: `${root}/listing.txt`,
              logPath: `${root}/import.log`,
              snapshotRoot: extractedRoot,
              verboseListingPath: `${root}/verbose-listing.txt`,
            });
            expect(
              yield* fileSystem.readFileString(`${extractedRoot}/tables.txt`)
            ).toBe(`${CONTENT_RUNTIME_TABLES.join("\n")}\n`);
            const ciphertext = yield* fileSystem.readFile(encryptedPath);
            const lastByte = ciphertext.at(-1);
            if (lastByte === undefined) {
              return yield* Effect.die(
                new Error("Expected encrypted test bytes.")
              );
            }
            ciphertext[ciphertext.length - 1] =
              lastByte === 255 ? 254 : lastByte + 1;
            yield* fileSystem.writeFile(encryptedPath, ciphertext);
            return yield* decryptAndExtractArchive({
              archivePath: `${root}/tampered.tar`,
              cacheKey: CACHE_KEY,
              encryptedPath,
              gpgHome: importGpgHome,
              listingPath: `${root}/tampered-listing.txt`,
              logPath: `${root}/tampered.log`,
              snapshotRoot: extractedRoot,
              verboseListingPath: `${root}/tampered-verbose-listing.txt`,
            }).pipe(Effect.flip);
          })
        ).pipe(Effect.provide(NodeServices.layer));
        expect(failure).toMatchObject({ _tag: "ContentSnapshotError" });
      }),
    20_000
  );
});
