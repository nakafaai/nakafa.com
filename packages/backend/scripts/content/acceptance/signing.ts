import {
  createHash,
  createPrivateKey,
  createPublicKey,
  generateKeyPairSync,
  randomBytes,
} from "node:crypto";
import { TrustedKeySchema } from "@nakafa/aksara-contracts/signature/trusted";
import { acceptanceRuntimeError } from "@repo/backend/scripts/content/acceptance/error";
import { Effect, FileSystem, Option, Schema } from "effect";

/** Public verification identity and exact ownership of its isolated private key file. */
export const LocalSigningIdentitySchema = Schema.Struct({
  ...TrustedKeySchema.fields,
  privateKeyPath: Schema.String,
  privateKeyInode: Schema.Finite,
  privateKeyHash: Schema.String,
});
export type LocalSigningIdentity = typeof LocalSigningIdentitySchema.Type;

/** Generates one acceptance-only Ed25519 identity without exposing private bytes. */
export const createLocalSigningIdentity = Effect.fn(
  "contentAcceptance.createSigningIdentity"
)(function* (directory: string) {
  const fs = yield* FileSystem.FileSystem;
  const keys = yield* Effect.try({
    try: () => ({
      ...generateKeyPairSync("ed25519", {
        privateKeyEncoding: { format: "pem", type: "pkcs8" },
        publicKeyEncoding: { format: "pem", type: "spki" },
      }),
      keyId: `acceptance-${randomBytes(16).toString("hex")}`,
      publicationToken: randomBytes(32).toString("base64url"),
    }),
    catch: () =>
      acceptanceRuntimeError(
        "The isolated acceptance signing identity could not be generated."
      ),
  });
  const privateKeyPath = `${directory}/signing-private.pem`;
  yield* fs.writeFileString(privateKeyPath, keys.privateKey, {
    mode: 0o600,
    flag: "wx",
  });
  yield* fs.chmod(privateKeyPath, 0o600);
  const info = yield* fs.stat(privateKeyPath);
  if (Option.isNone(info.ino)) {
    return yield* acceptanceRuntimeError(
      "The isolated private key has no filesystem identity."
    );
  }
  const signing = yield* Schema.decodeEffect(LocalSigningIdentitySchema)({
    keyId: keys.keyId,
    publicKeyPem: keys.publicKey,
    privateKeyPath,
    privateKeyInode: info.ino.value,
    privateKeyHash: createHash("sha256").update(keys.privateKey).digest("hex"),
  });
  return { signing, publicationToken: keys.publicationToken };
});

/** Refuses a moved, exposed, replaced, or altered key before reusing its local database. */
export const verifyLocalSigningIdentity = Effect.fn(
  "contentAcceptance.verifySigningIdentity"
)(function* (directory: string, signing: LocalSigningIdentity) {
  const fs = yield* FileSystem.FileSystem;
  const expectedPath = `${directory}/signing-private.pem`;
  if (signing.privateKeyPath !== expectedPath) {
    return yield* acceptanceRuntimeError(
      "The isolated private key path changed; existing state is preserved."
    );
  }
  const info = yield* fs.stat(expectedPath);
  if (
    info.type !== "File" ||
    info.mode % 0o1000 !== 0o600 ||
    Option.isNone(info.ino) ||
    info.ino.value !== signing.privateKeyInode ||
    (yield* fs.realPath(expectedPath)) !== expectedPath
  ) {
    return yield* acceptanceRuntimeError(
      "The isolated private key changed ownership or permissions; existing state is preserved."
    );
  }
  const privateKeyPem = yield* fs.readFileString(expectedPath);
  const coherent = yield* Effect.try({
    try: () => {
      const key = createPrivateKey(privateKeyPem);
      return (
        key.asymmetricKeyType === "ed25519" &&
        createHash("sha256").update(privateKeyPem).digest("hex") ===
          signing.privateKeyHash &&
        createPublicKey(key).export({ format: "pem", type: "spki" }) ===
          signing.publicKeyPem
      );
    },
    catch: () =>
      acceptanceRuntimeError(
        "The isolated private key is invalid; existing state is preserved."
      ),
  });
  if (!coherent) {
    return yield* acceptanceRuntimeError(
      "The isolated signing identity changed; existing state is preserved."
    );
  }
});
