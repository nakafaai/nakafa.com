import { generateKeyPairSync } from "node:crypto";
import { acceptanceRuntimeError } from "@repo/backend/scripts/content/acceptance/error";
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
      publicKey: Schema.fromJsonString(Schema.Unknown),
    }),
  ])
);

/** A JSON Web Key as JSON text, the form Better Auth encrypts. */
const encodeJwk = Schema.encodeEffect(Schema.fromJsonString(Schema.Unknown));

/**
 * Creates the one RS256 key the local backend signs session tokens with, as
 * the static JWKS that Convex Better Auth reads from `JWKS`: the auth config
 * verifies tokens with its public half, and Better Auth decrypts its private
 * half with the runtime's secret before signing. Every runtime gets its own
 * key, so no key material is kept anywhere else. Effect's `Crypto` has no RSA
 * key generation, so Node's creates the pair.
 *
 * @see https://labs.convex.dev/better-auth/experimental#static-jwks
 */
export const createLocalJwks = Effect.fn("contentAcceptance.createLocalJwks")(
  function* () {
    const createdAt = yield* Clock.currentTimeMillis;
    const crypto = yield* Crypto.Crypto;
    const id = yield* crypto.randomUUIDv4;
    const pair = yield* Effect.sync(() =>
      generateKeyPairSync("rsa", { modulusLength: 2048 })
    );
    const privateJwk = yield* encodeJwk(
      pair.privateKey.export({ format: "jwk" })
    );
    const privateKey = yield* Effect.tryPromise({
      catch: () =>
        acceptanceRuntimeError(
          "The local session signing key could not be encrypted."
        ),
      try: () => symmetricEncrypt({ data: privateJwk, key: LOCAL_AUTH_SECRET }),
    });
    return yield* Schema.encodeEffect(LocalJwks)([
      {
        alg: "RS256",
        createdAt,
        id,
        privateKey,
        publicKey: pair.publicKey.export({ format: "jwk" }),
      },
    ]);
  }
);
