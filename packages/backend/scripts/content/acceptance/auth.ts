import { generateKeyPairSync, randomUUID } from "node:crypto";
import { acceptanceRuntimeError } from "@repo/backend/scripts/content/acceptance/error";
import { symmetricEncrypt } from "better-auth/crypto";
import { Clock, Effect } from "effect";

/**
 * Signs the local backend's Better Auth cookies and encrypts its token signing
 * key. Long and varied enough that Better Auth's secret checks stay quiet; it
 * never leaves the local runtime.
 */
export const LOCAL_AUTH_SECRET = "acceptance-inert-secret-9fK2qL7xVz4NbT6w";

/**
 * Creates the one RS256 key the local backend signs session tokens with, as
 * the static JWKS that Convex Better Auth reads from `JWKS`: the auth config
 * verifies tokens with its public half, and Better Auth decrypts its private
 * half with the runtime's secret before signing. Every runtime gets its own
 * key, so no key material is kept anywhere else.
 *
 * @see https://labs.convex.dev/better-auth/experimental#static-jwks
 */
export const createLocalJwks = Effect.fn("contentAcceptance.createLocalJwks")(
  function* () {
    const createdAt = yield* Clock.currentTimeMillis;
    const { id, pair } = yield* Effect.sync(() => ({
      id: randomUUID(),
      pair: generateKeyPairSync("rsa", { modulusLength: 2048 }),
    }));
    const privateKey = yield* Effect.tryPromise({
      catch: () =>
        acceptanceRuntimeError(
          "The local session signing key could not be encrypted."
        ),
      try: () =>
        symmetricEncrypt({
          data: JSON.stringify(pair.privateKey.export({ format: "jwk" })),
          key: LOCAL_AUTH_SECRET,
        }),
    });
    // Better Auth stores both halves as JSON text, the encrypted private half
    // as a JSON string, and parses them back before use.
    return JSON.stringify([
      {
        alg: "RS256",
        createdAt,
        id,
        privateKey: JSON.stringify(privateKey),
        publicKey: JSON.stringify(pair.publicKey.export({ format: "jwk" })),
      },
    ]);
  }
);
