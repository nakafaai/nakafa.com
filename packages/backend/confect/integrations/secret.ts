import { layer as WebCryptoLayer } from "@effect/platform-browser/BrowserCrypto";
import { matchesSecret, sha256Hex } from "@repo/utilities/digest";
import { Crypto, Effect } from "effect";
import { Base64Url } from "effect/encoding";

/** Random bytes of one client secret: 256 bits, far more than anyone can guess. */
const SECRET_BYTES = 32;

/**
 * Draws a new client secret and the SHA-256 digest that the registry stores.
 * The secret is shown once and never stored. A failed random source is a
 * deployment defect, so it dies instead of reaching the caller.
 */
export const issueSecret = Effect.fn("integrations.secret.issue")(
  function* () {
    const bytes = yield* (yield* Crypto.Crypto).randomBytes(SECRET_BYTES);
    const secret = Base64Url.encode(bytes);
    return { hash: yield* sha256Hex(secret), secret };
  },
  Effect.orDie,
  Effect.provide(WebCryptoLayer)
);

/**
 * Whether a presented secret is the one whose digest is stored. The presented
 * secret is digested first. `matchesSecret` then compares the two digests in
 * constant time, reading every byte of both, so the answer does not depend on
 * where the values first differ.
 */
export const matchesClientSecret = Effect.fn("integrations.secret.matches")(
  function* (presented: string, hash: string) {
    return yield* matchesSecret(yield* sha256Hex(presented), hash);
  },
  Effect.orDie
);
