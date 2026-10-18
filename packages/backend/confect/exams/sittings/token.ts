import { layer as WebCryptoLayer } from "@effect/platform-browser/BrowserCrypto";
import type { readTenantKeys } from "@repo/backend/confect/vault/keys";
import { blindText } from "@repo/backend/confect/vault/text";
import { Array as Arr, Crypto, Effect, Random } from "effect";
import { Base64Url } from "effect/encoding";

/**
 * The characters that a sitting token draws from. The alphabet has no I, O, 0, or 1
 * (ADR 0013).
 */
const TOKEN_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

/** A sitting token has six characters, such as `K7Q4XM` (ADR 0013). */
const TOKEN_LENGTH = 6;

/** Bytes of the seed that starts a token's random generator. `Crypto` draws them. */
const SEED_BYTES = 32;

/** One character of a token, chosen evenly from the alphabet. */
const character = Random.nextIntBetween(0, TOKEN_ALPHABET.length, {
  halfOpen: true,
}).pipe(Effect.map((index) => TOKEN_ALPHABET.charAt(index)));

/**
 * Draws a token from a random generator seeded with `seed`, so the same seed always
 * draws the same token. The seed must come from a cryptographic source, which is why
 * `drawToken` takes it from `Crypto`.
 */
export const drawTokenFrom = (seed: Uint8Array) =>
  Effect.all(Arr.makeBy(TOKEN_LENGTH, () => character)).pipe(
    Effect.map((characters) => Arr.join(characters, "")),
    Random.withSeed(Base64Url.encode(seed))
  );

/**
 * Draws a new sitting token. The random generator is seeded with bytes from `Crypto`,
 * so the token is as strong as the platform's random source. A failed random source
 * fails with `PlatformError`.
 */
export const drawToken = Effect.fn("exams.sittings.drawToken")(function* () {
  const seed = yield* (yield* Crypto.Crypto).randomBytes(SEED_BYTES);
  return yield* drawTokenFrom(seed);
}, Effect.provide(WebCryptoLayer));

/** The school keys that `readTenantKeys` returns. */
type SchoolKeys = Effect.Success<ReturnType<typeof readTenantKeys>>;

/**
 * The keyed hash of a sitting's token: the school's blind key over the token, bound to
 * the token field of the sitting. The hash never verifies for another sitting, and it
 * is the only form of the token that the server stores. The result is 22 URL-safe
 * characters.
 */
export const tokenHash = Effect.fn("exams.sittings.tokenHash")(function* (
  keys: SchoolKeys,
  sittingId: string,
  token: string
) {
  return yield* blindText(
    keys,
    { field: "token", row: [sittingId], table: "examSittings" },
    token
  );
});
