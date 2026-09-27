import { Effect, Schema } from "effect";

const BEARER_PREFIX = "Bearer ";
const TOKEN_WHITESPACE = /\s/u;

/** Web Crypto could not derive one fixed-width secret comparison input. */
export class HttpSecretError extends Schema.TaggedError<HttpSecretError>()(
  "HttpSecretError",
  {}
) {}

/** Extracts one exact bearer value or an empty invalid candidate. */
export function bearerToken(authorization: string) {
  return authorization.startsWith(BEARER_PREFIX)
    ? authorization.slice(BEARER_PREFIX.length)
    : "";
}

/** Confirms one deployment secret is non-empty and contains no whitespace. */
function isValidSecret(value: string) {
  return value.length > 0 && !TOKEN_WHITESPACE.test(value);
}

/** Hashes one credential into a fixed-width comparison input. */
const credentialDigest = Effect.fn("contentRelease.credentialDigest")(
  (value: string) =>
    Effect.tryPromise({
      catch: () => new HttpSecretError(),
      try: () =>
        crypto.subtle.digest("SHA-256", new TextEncoder().encode(value)),
    })
);

/** Compares equal-width digests without data-dependent early returns. */
function equalDigest(left: ArrayBuffer, right: ArrayBuffer) {
  const leftBytes = new Uint8Array(left);
  const rightBytes = new Uint8Array(right);
  let difference = 0;
  for (let index = 0; index < leftBytes.length; index += 1) {
    difference += Math.abs(leftBytes[index] - rightBytes[index]);
  }
  return difference === 0;
}

/** Timing-safely compares one untrusted candidate with a deployment secret. */
export const matchesHttpSecret = Effect.fn("contentRelease.matchesHttpSecret")(
  function* (candidate: string, secret: string) {
    const [candidateDigest, secretDigest] = yield* Effect.all([
      credentialDigest(candidate),
      credentialDigest(secret),
    ]);
    return (
      isValidSecret(candidate) &&
      isValidSecret(secret) &&
      equalDigest(candidateDigest, secretDigest)
    );
  }
);
