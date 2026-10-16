import { layer as WebCryptoLayer } from "@effect/platform-browser/BrowserCrypto";
import { matchesSecret, sha256Hex } from "@repo/utilities/digest";
import { Crypto, Effect } from "effect";
import { Base64Url } from "effect/encoding";

/** Random bytes of one bearer token: 256 bits, far more than anyone can guess. */
const TOKEN_BYTES = 32;

/**
 * Draws a new bearer token, written as Base64Url, and the SHA-256 digest that is
 * stored in its place. The token is shown once and never stored in the clear, so
 * a reader of the database cannot present it. A failed random source fails with
 * `PlatformError`, and each caller maps it to its own failure.
 */
export const issueToken = Effect.fn("utilities.token.issue")(function* () {
  const bytes = yield* (yield* Crypto.Crypto).randomBytes(TOKEN_BYTES);
  const token = Base64Url.encode(bytes);
  return { hash: yield* sha256Hex(token), token };
}, Effect.provide(WebCryptoLayer));

/**
 * Whether a presented token is the one whose digest is stored. The presented
 * token is digested first, and `matchesSecret` compares the two digests reading
 * every byte of both, so the answer does not depend on where they first differ.
 */
export const matchesToken = Effect.fn("utilities.token.matches")(function* (
  presented: string,
  hash: string
) {
  return yield* matchesSecret(yield* sha256Hex(presented), hash);
});
