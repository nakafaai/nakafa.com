import { TrustedKeySchema } from "@nakafa/aksara-contracts/signature/trusted";
import { acceptanceRuntimeError } from "@repo/backend/scripts/content/acceptance/error";
import { sha256Hex } from "@repo/utilities/digest";
import { Crypto, Effect, FileSystem, Option, Result, Schema } from "effect";
import { Base64, Base64Url, Hex } from "effect/encoding";

/** Public verification identity and exact ownership of its isolated private key file. */
export const LocalSigningIdentitySchema = Schema.Struct({
  ...TrustedKeySchema.fields,
  privateKeyPath: Schema.String,
  privateKeyInode: Schema.BigIntFromString,
  privateKeyHash: Schema.String,
});
type LocalSigningIdentity = typeof LocalSigningIdentitySchema.Type;

/** The members of an Ed25519 key's JWK that make up its public key; decoding drops the private ones. */
const PublicJwk = Schema.Struct({
  crv: Schema.Literal("Ed25519"),
  kty: Schema.Literal("OKP"),
  x: Schema.String,
});
const PRIVATE_KEY_LABEL = "PRIVATE KEY";
const PUBLIC_KEY_LABEL = "PUBLIC KEY";

/** Reports a private key that cannot be proven to be the isolated signing key. */
function invalidPrivateKey() {
  return acceptanceRuntimeError(
    "The isolated private key is invalid; existing state is preserved."
  );
}

/**
 * Writes DER bytes as PEM text the way OpenSSL does, with a newline after each
 * line. OpenSSL wraps the Base64 at 64 characters, but an Ed25519 key is 48
 * bytes private and 44 bytes public, so its Base64 is 64 and 60 characters and
 * always fits one line.
 */
function encodePem(label: string, der: Uint8Array) {
  return `-----BEGIN ${label}-----\n${Base64.encode(der)}\n-----END ${label}-----\n`;
}

/** Reads the DER bytes of PEM text with this label, or nothing when the text is no such PEM. */
function decodePem(label: string, pem: string) {
  const header = `-----BEGIN ${label}-----\n`;
  const footer = `\n-----END ${label}-----\n`;
  if (!(pem.startsWith(header) && pem.endsWith(footer))) {
    return Option.none();
  }
  return Result.getSuccess(
    Base64.decode(pem.slice(header.length, pem.length - footer.length))
  );
}

/**
 * Derives the public key of an Ed25519 private key as PEM text. Web Crypto
 * exports no public key from a private one, so the key goes out as a JWK, whose
 * `x` member is the public key, and comes back in as a public key.
 */
const derivePublicKeyPem = Effect.fn("contentAcceptance.derivePublicKey")(
  function* (privateKeyPem: string) {
    const der = yield* Effect.fromOption(
      decodePem(PRIVATE_KEY_LABEL, privateKeyPem)
    ).pipe(Effect.mapError(invalidPrivateKey));
    const publicJwk = yield* Effect.tryPromise({
      catch: invalidPrivateKey,
      // Web Crypto takes bytes that an ArrayBuffer backs, so the bytes are copied.
      try: () =>
        crypto.subtle
          .importKey("pkcs8", Uint8Array.from(der), "Ed25519", true, ["sign"])
          .then((key) => crypto.subtle.exportKey("jwk", key)),
    }).pipe(
      Effect.flatMap(Schema.decodeUnknownEffect(PublicJwk)),
      Effect.mapError(invalidPrivateKey)
    );
    const publicDer = yield* Effect.tryPromise({
      catch: invalidPrivateKey,
      try: () =>
        crypto.subtle
          .importKey("jwk", publicJwk, "Ed25519", true, ["verify"])
          .then((key) => crypto.subtle.exportKey("spki", key)),
    });
    return encodePem(PUBLIC_KEY_LABEL, new Uint8Array(publicDer));
  }
);

/** Generates one acceptance-only Ed25519 identity without exposing private bytes. */
export const createLocalSigningIdentity = Effect.fn(
  "contentAcceptance.createSigningIdentity"
)(function* (directory: string) {
  const fs = yield* FileSystem.FileSystem;
  const random = yield* Crypto.Crypto;
  const [privateDer, publicDer] = yield* Effect.tryPromise({
    catch: () =>
      acceptanceRuntimeError(
        "The isolated acceptance signing identity could not be generated."
      ),
    try: () =>
      crypto.subtle
        .generateKey("Ed25519", true, ["sign", "verify"])
        .then((pair) =>
          Promise.all([
            crypto.subtle.exportKey("pkcs8", pair.privateKey),
            crypto.subtle.exportKey("spki", pair.publicKey),
          ])
        ),
  });
  const privateKeyPem = encodePem(
    PRIVATE_KEY_LABEL,
    new Uint8Array(privateDer)
  );
  const keyId = `acceptance-${Hex.encode(yield* Effect.orDie(random.randomBytes(16)))}`;
  const publicationToken = Base64Url.encode(
    yield* Effect.orDie(random.randomBytes(32))
  );
  const privateKeyPath = `${directory}/signing-private.pem`;
  yield* fs.writeFileString(privateKeyPath, privateKeyPem, {
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
  const privateKeyHash = yield* sha256Hex(privateKeyPem).pipe(Effect.orDie);
  const signing = yield* Schema.decodeEffect(LocalSigningIdentitySchema)({
    keyId,
    publicKeyPem: encodePem(PUBLIC_KEY_LABEL, new Uint8Array(publicDer)),
    privateKeyPath,
    privateKeyInode: info.ino.value.toString(),
    privateKeyHash,
  });
  return { signing, publicationToken };
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
  const privateKeyHash = yield* sha256Hex(privateKeyPem).pipe(
    Effect.mapError(invalidPrivateKey)
  );
  const publicKeyPem = yield* derivePublicKeyPem(privateKeyPem);
  if (
    privateKeyHash !== signing.privateKeyHash ||
    publicKeyPem !== signing.publicKeyPem
  ) {
    return yield* acceptanceRuntimeError(
      "The isolated signing identity changed; existing state is preserved."
    );
  }
});
