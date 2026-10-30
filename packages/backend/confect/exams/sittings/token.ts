import type { TenantKeys } from "@repo/backend/confect/vault/keys";
import {
  blindText,
  openText,
  sealText,
} from "@repo/backend/confect/vault/text";
import { Array as Arr, Effect, Random } from "effect";
import { SecureRandom } from "effect/crypto";
import { Base64Url } from "effect/encoding";

/**
 * The characters that a sitting token draws from. The alphabet has no I, O, 0, or 1
 * (ADR 0013).
 */
const TOKEN_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

/** A sitting token has six characters, such as `K7Q4XM` (ADR 0013). */
const TOKEN_LENGTH = 6;

/** Bytes of the seed that starts a token's random generator. `SecureRandom` draws them. */
const SEED_BYTES = 32;

/** One character of a token, chosen evenly from the alphabet. */
const character = Random.nextIntBetween(0, TOKEN_ALPHABET.length, {
  halfOpen: true,
}).pipe(Effect.map((index) => TOKEN_ALPHABET.charAt(index)));

/**
 * Draws a token from a random generator seeded with `seed`, so the same seed always
 * draws the same token. The seed must come from a cryptographic source, which is why
 * `drawToken` takes it from `SecureRandom`.
 */
export const drawTokenFrom = (seed: Uint8Array) =>
  Effect.all(Arr.makeBy(TOKEN_LENGTH, () => character)).pipe(
    Effect.map((characters) => Arr.join(characters, "")),
    Random.withSeed(Base64Url.encode(seed))
  );

/**
 * Draws a new sitting token. The random generator is seeded with bytes from
 * `SecureRandom`, so the token is as strong as the platform's random source. A failed
 * random source is a defect.
 */
export const drawToken = Effect.fn("exams.sittings.drawToken")(function* () {
  const seed = yield* (yield* SecureRandom.SecureRandom).randomBytes(
    SEED_BYTES
  );
  return yield* drawTokenFrom(seed);
}, Effect.provide(SecureRandom.layerWebCrypto));

/**
 * A token as the server compares it: without a space at either end, and in upper case,
 * so a student who types it in lower case still enters (round 2, decision 11).
 */
export const normalizeToken = (text: string) => text.trim().toUpperCase();

/**
 * The keyed hash of a sitting's token: the school's blind key over the token, bound to
 * the token field of the sitting. The hash never verifies for another sitting, and it
 * is the only form of the token that the server stores. The result is 22 URL-safe
 * characters.
 */
export const tokenHash = Effect.fn("exams.sittings.tokenHash")(function* (
  keys: TenantKeys,
  sittingId: string,
  token: string
) {
  return yield* blindText(
    keys,
    { field: "token", row: [sittingId], table: "examSittings" },
    token
  );
});

/**
 * The field of a sitting's sealed token. It is bound to the sitting's row, so a sealed
 * token copied to another sitting never opens (ADR 0030).
 */
const sealedTokenField = (sittingId: string) => ({
  field: "tokenSealed",
  row: [sittingId],
  table: "examSittings",
});

/**
 * Seals a sitting's token under the school key, so a proctor can read it again. The
 * student never gets it from a read: only the proctor's dashboard opens it (ADR 0013).
 */
export const sealToken = Effect.fn("exams.sittings.token.seal")(function* (
  keys: TenantKeys,
  sittingId: string,
  token: string
) {
  return yield* sealText(keys, sealedTokenField(sittingId), token);
});

/** Opens the sealed token of a sitting for a proctor, with the school keys that sealed it. */
export const openToken = Effect.fn("exams.sittings.token.open")(function* (
  keys: TenantKeys,
  sittingId: string,
  sealed: ArrayBuffer
) {
  return yield* openText(keys, sealedTokenField(sittingId), sealed);
});
