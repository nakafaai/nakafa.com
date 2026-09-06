import { tmpdir } from "node:os";
import { layer as nodeServicesLayer } from "@effect/platform-node/NodeServices";
import { describe, expect, it } from "@effect/vitest";
import {
  createLocalSigningIdentity,
  verifyLocalSigningIdentity,
} from "@repo/backend/scripts/content/acceptance/signing";
import { Effect, FileSystem, Option } from "effect";

const cryptoMock = vi.hoisted(() => ({ generateKeyPairSync: vi.fn() }));
vi.mock("node:crypto", async (importOriginal) => {
  const original = await importOriginal<typeof import("node:crypto")>();
  return {
    ...original,
    generateKeyPairSync: cryptoMock.generateKeyPairSync.mockImplementation(
      original.generateKeyPairSync
    ),
  };
});

const fixture = Effect.gen(function* () {
  const fs = yield* FileSystem.FileSystem;
  const temporary = yield* fs.makeTempDirectoryScoped({
    directory: tmpdir(),
    prefix: "acceptance-signing-test-",
  });
  const directory = yield* fs.realPath(temporary);
  const identity = yield* createLocalSigningIdentity(directory);
  return { ...identity, directory, fs };
});

describe("isolated acceptance signing identity", () => {
  it.live(
    "fails before writing private state when signing-key generation is unavailable",
    () =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const directory = yield* fs.makeTempDirectoryScoped({
          directory: tmpdir(),
          prefix: "acceptance-signing-test-",
        });
        cryptoMock.generateKeyPairSync.mockImplementationOnce(() => {
          throw new Error("Operating system entropy is unavailable.");
        });
        expect(
          yield* createLocalSigningIdentity(directory).pipe(Effect.flip)
        ).toMatchObject({
          _tag: "AcceptanceRuntimeError",
          message:
            "The isolated acceptance signing identity could not be generated.",
        });
        expect(yield* fs.readDirectory(directory)).toEqual([]);
      }).pipe(Effect.provide(nodeServicesLayer))
  );

  it.live(
    "keeps private bytes in one protected file and generates independent identities",
    () =>
      Effect.gen(function* () {
        const first = yield* fixture;
        const second = yield* fixture;
        const privateKey = yield* first.fs.readFileString(
          first.signing.privateKeyPath
        );
        expect(privateKey).toContain("BEGIN PRIVATE KEY");
        expect(first.signing.publicKeyPem).toContain("BEGIN PUBLIC KEY");
        expect(JSON.stringify(first.signing)).not.toContain(privateKey);
        expect(first.signing.keyId).not.toBe(second.signing.keyId);
        expect(first.signing.publicKeyPem).not.toBe(
          second.signing.publicKeyPem
        );
        expect(first.publicationToken).not.toBe(second.publicationToken);
        expect(first.publicationToken.length).toBeGreaterThanOrEqual(40);
        expect(
          (yield* first.fs.stat(first.signing.privateKeyPath)).mode % 0o1000
        ).toBe(0o600);
        yield* verifyLocalSigningIdentity(first.directory, first.signing);
        yield* verifyLocalSigningIdentity(second.directory, second.signing);
      }).pipe(Effect.provide(nodeServicesLayer))
  );

  for (const change of [
    "path",
    "permissions",
    "inode",
    "hash",
    "public-key",
    "content",
    "symlink",
  ]) {
    it.live(`preserves a private key after its ${change} changes`, () =>
      Effect.gen(function* () {
        const { directory, fs, signing } = yield* fixture;
        const next = { ...signing };
        if (change === "path") {
          next.privateKeyPath = `${directory}/foreign.pem`;
        }
        if (change === "permissions") {
          yield* fs.chmod(signing.privateKeyPath, 0o644);
        }
        if (change === "inode") {
          next.privateKeyInode = -1;
        }
        if (change === "hash") {
          next.privateKeyHash = "changed";
        }
        if (change === "public-key") {
          next.publicKeyPem = (yield* fixture).signing.publicKeyPem;
        }
        if (change === "content") {
          yield* fs.writeFileString(signing.privateKeyPath, "invalid key");
        }
        if (change === "symlink") {
          yield* fs.rename(signing.privateKeyPath, `${directory}/original.pem`);
          yield* fs.symlink(
            `${directory}/original.pem`,
            signing.privateKeyPath
          );
        }
        expect(
          yield* verifyLocalSigningIdentity(directory, next).pipe(Effect.flip)
        ).toMatchObject({ _tag: "AcceptanceRuntimeError" });
        expect(yield* fs.exists(signing.privateKeyPath)).toBe(true);
      }).pipe(Effect.provide(nodeServicesLayer))
    );
  }

  it.live("rejects a signing file without filesystem identity", () =>
    Effect.gen(function* () {
      const { directory, fs, signing } = yield* fixture;
      const reader = {
        ...fs,
        stat: (path: string) =>
          fs
            .stat(path)
            .pipe(
              Effect.map((info) => ({ ...info, ino: Option.none<number>() }))
            ),
      };
      expect(
        yield* verifyLocalSigningIdentity(directory, signing).pipe(
          Effect.provideService(FileSystem.FileSystem, reader),
          Effect.flip
        )
      ).toMatchObject({ _tag: "AcceptanceRuntimeError" });
      yield* fs.makeDirectory(`${directory}/new`);
      expect(
        yield* createLocalSigningIdentity(`${directory}/new`).pipe(
          Effect.provideService(FileSystem.FileSystem, reader),
          Effect.flip
        )
      ).toMatchObject({ _tag: "AcceptanceRuntimeError" });
    }).pipe(Effect.provide(nodeServicesLayer))
  );
});
