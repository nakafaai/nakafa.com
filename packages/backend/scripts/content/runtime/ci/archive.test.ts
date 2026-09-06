import { layer as nodeServicesLayer } from "@effect/platform-node/NodeServices";
import { describe, expect, it } from "@effect/vitest";
import { CONTENT_RUNTIME_TABLES } from "@repo/backend/content/snapshot/tables";
import {
  createEncryptedArchive,
  decryptAndExtractArchive,
} from "@repo/backend/scripts/content/runtime/ci/archive";
// biome-ignore lint/performance/noNamespaceImport: Vitest spies on this module namespace to control the owning failure boundary.
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
  yield* fileSystem.makeDirectory(snapshotRoot, { mode: 0o700 });
  yield* fileSystem.writeFileString(`${snapshotRoot}/metadata.json`, "{}\n");
  return {
    archivePath: `${root}/runtime.tar`,
    cacheKey: CACHE_KEY,
    encryptedPath: `${root}/runtime.tar.gpg`,
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
    }).pipe(Effect.scoped, Effect.provide(nodeServicesLayer))
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
        }).pipe(Effect.scoped, Effect.provide(nodeServicesLayer))
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
    }).pipe(Effect.scoped, Effect.provide(nodeServicesLayer))
  );

  it.live(
    "authenticates deeply nested snapshots and removes agent homes on success and failure",
    () =>
      Effect.gen(function* () {
        const fileSystem = yield* FileSystem.FileSystem;
        const homes = new Set<string>();
        const command = vi
          .spyOn(commands, "runRuntimeCommand")
          .mockImplementation((spec) =>
            Effect.gen(function* () {
              const home = spec.args[spec.args.indexOf("--homedir") + 1];
              if (spec.command === "gpg" && home !== undefined) {
                homes.add(home);
                expect((yield* fileSystem.stat(home)).mode % 0o1000).toBe(
                  0o700
                );
              }
              return yield* runCommand(spec);
            })
          );
        const failure = yield* Effect.scoped(
          Effect.gen(function* () {
            const directory = yield* fileSystem.makeTempDirectoryScoped({
              directory: "/tmp",
              prefix: "content-runtime-archive-test-",
            });
            const root = `${directory}/${"nested-snapshot/".repeat(10)}`;
            yield* fileSystem.makeDirectory(root, {
              mode: 0o700,
              recursive: true,
            });
            const encryptedPath = `${root}/runtime.tar.gpg`;
            const extractedRoot = `${root}/extracted`;
            const snapshotRoot = `${root}/snapshot`;
            for (const target of [extractedRoot, snapshotRoot]) {
              yield* fileSystem.makeDirectory(target, { mode: 0o700 });
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
              logPath: `${root}/export.log`,
              snapshotRoot,
            });
            expect((yield* fileSystem.stat(encryptedPath)).mode % 0o1000).toBe(
              0o600
            );
            yield* decryptAndExtractArchive({
              archivePath: `${root}/decrypted.tar`,
              cacheKey: CACHE_KEY,
              encryptedPath,
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
              listingPath: `${root}/tampered-listing.txt`,
              logPath: `${root}/tampered.log`,
              snapshotRoot: extractedRoot,
              verboseListingPath: `${root}/tampered-verbose-listing.txt`,
            }).pipe(Effect.flip);
          })
        ).pipe(Effect.ensuring(Effect.sync(() => command.mockRestore())));
        expect(failure).toMatchObject({ _tag: "ContentSnapshotError" });
        expect(homes.size).toBeGreaterThan(0);
        for (const home of homes) {
          expect(yield* fileSystem.exists(home)).toBe(false);
        }
      }).pipe(Effect.provide(nodeServicesLayer)),
    20_000
  );
});
