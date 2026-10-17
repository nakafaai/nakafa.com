import { layer as nodeServicesLayer } from "@effect/platform-node/NodeServices";
import { afterEach, describe, expect, it } from "@effect/vitest";
import {
  createLocalSigningIdentity,
  LocalSigningIdentitySchema,
  verifyLocalSigningIdentity,
} from "@repo/backend/scripts/content/acceptance/signing";
import { Effect, FileSystem, Option, Schema } from "effect";

const message = new TextEncoder().encode("technical acceptance message");
/** The most Base64 characters on one line of the PEM text that OpenSSL writes. */
const PEM_LINE_LENGTH = 64;

afterEach(() => {
  vi.restoreAllMocks();
});

const fixture = Effect.gen(function* () {
  const fs = yield* FileSystem.FileSystem;
  const temporary = yield* fs.makeTempDirectoryScoped({
    prefix: "acceptance-signing-test-",
  });
  const directory = yield* fs.realPath(temporary);
  const identity = yield* createLocalSigningIdentity(directory);
  return { ...identity, directory, fs };
});

/** Reads the DER bytes of PEM text with Node's Buffer, so no Effect code vouches for itself. */
function derOf(pem: string, label: string) {
  return Buffer.from(
    pem
      .replace(`-----BEGIN ${label}-----`, "")
      .replace(`-----END ${label}-----`, "")
      .replaceAll("\n", ""),
    "base64"
  );
}

/**
 * Each change to the stored identity or its file, with what the check says. A
 * file that holds no PEM and one that holds a PEM around bytes that are no
 * Ed25519 key fail in different places.
 */
const CHANGES = [
  {
    change: "path",
    message:
      "The isolated private key path changed; existing state is preserved.",
  },
  {
    change: "permissions",
    message:
      "The isolated private key changed ownership or permissions; existing state is preserved.",
  },
  {
    change: "inode",
    message:
      "The isolated private key changed ownership or permissions; existing state is preserved.",
  },
  {
    change: "symlink",
    message:
      "The isolated private key changed ownership or permissions; existing state is preserved.",
  },
  {
    change: "hash",
    message:
      "The isolated signing identity changed; existing state is preserved.",
  },
  {
    change: "public-key",
    message:
      "The isolated signing identity changed; existing state is preserved.",
  },
  {
    change: "content",
    message:
      "The isolated private key is invalid; existing state is preserved.",
  },
  {
    change: "key",
    message:
      "The isolated private key is invalid; existing state is preserved.",
  },
];

describe("isolated acceptance signing identity", () => {
  it.live(
    "fails before writing private state when signing-key generation is unavailable",
    () =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const directory = yield* fs.makeTempDirectoryScoped({
          prefix: "acceptance-signing-test-",
        });
        vi.spyOn(crypto.subtle, "generateKey").mockRejectedValueOnce(
          new Error("Operating system entropy is unavailable.")
        );
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
        // JSON escapes the newlines of a PEM, so the whole PEM never appears in
        // its text. A body line has nothing to escape and would appear verbatim.
        const [, privateKeyBody] = privateKey.split("\n");
        expect(privateKeyBody).toBeDefined();
        const identityJson = yield* Schema.encodeEffect(
          Schema.fromJsonString(LocalSigningIdentitySchema)
        )(first.signing);
        expect(identityJson).not.toContain(privateKeyBody);
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

  it.live(
    "writes a pair that signs and verifies, in the PEM form OpenSSL writes",
    () =>
      Effect.gen(function* () {
        const { fs, signing } = yield* fixture;
        const privateKey = yield* fs.readFileString(signing.privateKeyPath);

        // A header, one body line of at most 64 characters, a footer, and a
        // newline that ends the text.
        for (const pem of [privateKey, signing.publicKeyPem]) {
          const lines = pem.split("\n");

          expect(lines).toHaveLength(4);
          expect(lines[1]?.length).toBeLessThanOrEqual(PEM_LINE_LENGTH);
          expect(lines[3]).toBe("");
        }
        const valid = yield* Effect.promise(() =>
          Promise.all([
            crypto.subtle.importKey(
              "pkcs8",
              derOf(privateKey, "PRIVATE KEY"),
              "Ed25519",
              false,
              ["sign"]
            ),
            crypto.subtle.importKey(
              "spki",
              derOf(signing.publicKeyPem, "PUBLIC KEY"),
              "Ed25519",
              false,
              ["verify"]
            ),
          ]).then(([signer, verifier]) =>
            crypto.subtle
              .sign("Ed25519", signer, message)
              .then((signature) =>
                crypto.subtle.verify("Ed25519", verifier, signature, message)
              )
          )
        );

        expect(valid).toBe(true);
      }).pipe(Effect.provide(nodeServicesLayer))
  );

  for (const { change, message: expected } of CHANGES) {
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
          next.privateKeyInode = -1n;
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
        if (change === "key") {
          yield* fs.writeFileString(
            signing.privateKeyPath,
            "-----BEGIN PRIVATE KEY-----\nAAAA\n-----END PRIVATE KEY-----\n"
          );
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
        ).toMatchObject({
          _tag: "AcceptanceRuntimeError",
          message: expected,
        });
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
              Effect.map((info) => ({ ...info, ino: Option.none<bigint>() }))
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
