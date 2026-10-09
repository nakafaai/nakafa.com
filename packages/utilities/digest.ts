import { layer as WebCryptoLayer } from "@effect/platform-browser/BrowserCrypto";
import { Array as Arr, Crypto, Effect } from "effect";
import { Hex } from "effect/encoding";

/**
 * Computes the SHA-256 digest bytes of one byte sequence through Effect's
 * `Crypto` service. The Web Crypto layer serves every runtime Nakafa runs in:
 * browsers, Node and Convex. A failed digest fails with `PlatformError`, and
 * each caller maps it to its own typed error.
 */
export const sha256 = Effect.fn("utilities.sha256")(function* (
  data: Uint8Array
) {
  const crypto = yield* Crypto.Crypto;
  return yield* crypto.digest("SHA-256", data);
}, Effect.provide(WebCryptoLayer));

/**
 * Computes the lower-case hexadecimal SHA-256 digest of the UTF-8 bytes of one
 * text. Stored identities, fingerprints, and digests use this form.
 */
export const sha256Hex = Effect.fn("utilities.sha256Hex")(function* (
  text: string
) {
  const digest = yield* sha256(new TextEncoder().encode(text));
  return Hex.encode(digest);
});

/**
 * Compares a candidate with a secret through their SHA-256 digests. Both
 * digests are computed before any byte is compared, and every byte is always
 * compared, so the outcome does not depend on where two values first differ.
 * The function accepts any text: each caller owns its emptiness and whitespace
 * rules.
 */
export const matchesSecret = Effect.fn("utilities.matchesSecret")(function* (
  candidate: string,
  secret: string
) {
  const [candidateDigest, secretDigest] = yield* Effect.all([
    sha256(new TextEncoder().encode(candidate)),
    sha256(new TextEncoder().encode(secret)),
  ]);
  const difference = Arr.reduce(
    Arr.zipWith(candidateDigest, secretDigest, (left, right) =>
      Math.abs(left - right)
    ),
    0,
    (total, distance) => total + distance
  );
  return difference === 0;
});
