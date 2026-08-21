import * as NodeServices from "@effect/platform-node/NodeServices";
import {
  createEncryptedArchive,
  decryptAndExtractArchive,
} from "@repo/backend/scripts/content-runtime/ci/archive";
import { CONTENT_RUNTIME_TABLES } from "@repo/backend/scripts/content-runtime/tables";
import { describe, expect, it } from "@repo/testing/effect";
import { Effect, FileSystem } from "effect";

const CACHE_KEY = "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGH";
describe("content runtime archive", () => {
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
        expect(failure).toMatchObject({ _tag: "ContentRuntimeCiError" });
      }),
    20_000
  );
});
