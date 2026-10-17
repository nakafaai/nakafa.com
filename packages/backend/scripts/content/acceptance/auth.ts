import { acceptanceRuntimeError } from "@repo/backend/scripts/content/acceptance/error";
import { JsonTextSchema } from "@repo/utilities/json";
import { symmetricEncrypt } from "better-auth/crypto";
import { Clock, Crypto, Effect, Schema } from "effect";

/**
 * Signs the local backend's Better Auth cookies and encrypts its token signing
 * key. Long and varied enough that Better Auth's secret checks stay quiet; it
 * never leaves the local runtime.
 */
export const LOCAL_AUTH_SECRET = "acceptance-inert-secret-9fK2qL7xVz4NbT6w";

/**
 * Better Auth's stored JWKS: each key keeps its public half as JSON text and
 * its encrypted private half as a JSON string, and is parsed back before use.
 */
const LocalJwks = Schema.fromJsonString(
  Schema.Tuple([
    Schema.Struct({
      alg: Schema.Literal("RS256"),
      createdAt: Schema.Finite,
      id: Schema.String,
      privateKey: Schema.fromJsonString(Schema.String),
      publicKey: JsonTextSchema,
    }),
  ])
);

/**
 * The members of an RSA public key as a JWK. Web Crypto adds `alg`, `ext`, and
 * `key_ops`; decoding drops them, so the stored key has the members that
 * Better Auth's own `exportJWK` writes.
 */
const PublicJwk = Schema.Struct({
  e: Schema.String,
  kty: Schema.Literal("RSA"),
  n: Schema.String,
});

/** The members of an RSA private key as a JWK, with the same members dropped. */
const PrivateJwk = Schema.Struct({
  d: Schema.String,
  dp: Schema.String,
  dq: Schema.String,
  e: Schema.String,
  kty: Schema.Literal("RSA"),
  n: Schema.String,
  p: Schema.String,
  q: Schema.String,
  qi: Schema.String,
});

/** A JSON Web Key as JSON text, the form Better Auth encrypts. */
const encodeJwk = Schema.encodeEffect(JsonTextSchema);

/**
 * Creates the one RS256 key the local backend signs session tokens with, as
 * the static JWKS that Convex Better Auth reads from `JWKS`: the auth config
 * verifies tokens with its public half, and Better Auth decrypts its private
 * half with the runtime's secret before signing. Every runtime gets its own
 * key, so no key material is kept anywhere else. Effect's `Crypto` has no RSA
 * key generation, so Web Crypto creates the pair.
 *
 * @see https://labs.convex.dev/better-auth/experimental#static-jwks
 */
export const createLocalJwks = Effect.fn("contentAcceptance.createLocalJwks")(
  function* () {
    const createdAt = yield* Clock.currentTimeMillis;
    const random = yield* Crypto.Crypto;
    const id = yield* random.randomUUIDv4();
    const [privateJwk, publicJwk] = yield* Effect.tryPromise({
      catch: () =>
        acceptanceRuntimeError(
          "The local session signing key could not be generated."
        ),
      try: () =>
        crypto.subtle
          .generateKey(
            {
              hash: "SHA-256",
              modulusLength: 2048,
              name: "RSASSA-PKCS1-v1_5",
              publicExponent: new Uint8Array([1, 0, 1]),
            },
            true,
            ["sign", "verify"]
          )
          .then((pair) =>
            Promise.all([
              crypto.subtle.exportKey("jwk", pair.privateKey),
              crypto.subtle.exportKey("jwk", pair.publicKey),
            ])
          ),
    });
    const privateText = yield* Schema.decodeUnknownEffect(PrivateJwk)(
      privateJwk
    ).pipe(Effect.flatMap(encodeJwk));
    const privateKey = yield* Effect.tryPromise({
      catch: () =>
        acceptanceRuntimeError(
          "The local session signing key could not be encrypted."
        ),
      try: () =>
        symmetricEncrypt({ data: privateText, key: LOCAL_AUTH_SECRET }),
    });
    return yield* Schema.encodeEffect(LocalJwks)([
      {
        alg: "RS256",
        createdAt,
        id,
        privateKey,
        publicKey: yield* Schema.decodeUnknownEffect(PublicJwk)(publicJwk),
      },
    ]);
  }
);
