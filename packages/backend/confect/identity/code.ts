import { layer as WebCryptoLayer } from "@effect/platform-browser/BrowserCrypto";
import {
  Array as Arr,
  Config,
  Crypto,
  Effect,
  pipe,
  Redacted,
  Schema,
  String as Str,
} from "effect";
import { Hex } from "effect/encoding";

/** The characters of a card code: Crockford base32, which leaves out I, L, O, and U. */
const CODE_ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
/** One character takes one byte. 32 divides 256 evenly, so every character is equally likely. */
const CODE_BYTE_MODULUS = CODE_ALPHABET.length;
const CODE_LENGTH = 10;
const GROUP_LENGTH = 5;
/** Names what the hash is for, so the same secret never hashes a code for another purpose. */
const CODE_HASH_LABEL = "nakafa/identity/card/v1:";
const encoder = new TextEncoder();

/** A card code as it is stored and compared: ten characters of the alphabet, no dash. */
const CardCode = Schema.String.check(
  Schema.isPattern(/^[0-9A-HJKMNP-TV-Z]{10}$/)
);

/** Shows a code as two groups of five characters, joined by a dash. */
export const formatCardCode = (code: string) =>
  `${Str.takeLeft(code, GROUP_LENGTH)}-${Str.takeRight(code, GROUP_LENGTH)}`;

/**
 * Reads a code as it was typed: spaces and dashes drop, and letters take any
 * case. As Crockford base32 reads them, O is 0 and I and L are 1, so a code typed
 * with those letters still reads. U is not a symbol of the alphabet and stays
 * refused. It is `None` when what is left is not a code of the alphabet.
 */
export const readCardCode = (input: string) =>
  pipe(
    input,
    Str.toUpperCase,
    Str.replaceAll(/[\s-]/gu, ""),
    Str.replaceAll(/O/gu, "0"),
    Str.replaceAll(/[IL]/gu, "1"),
    Schema.decodeOption(CardCode)
  );

/** Turns random bytes into a code, one character for each byte. */
export const codeFromBytes = (bytes: Uint8Array) =>
  pipe(
    Arr.fromIterable(bytes),
    Arr.map((byte) => CODE_ALPHABET.charAt(byte % CODE_BYTE_MODULUS)),
    Arr.join("")
  );

/**
 * Draws a new canonical code from Effect's `Crypto` service, which reads the
 * platform's secure random source. Effect's default `Random` is not secure, so
 * a code never comes from it.
 */
export const drawCardCode = Effect.fn("identity.code.draw")(
  function* () {
    const bytes = yield* (yield* Crypto.Crypto).randomBytes(CODE_LENGTH);
    return codeFromBytes(bytes);
  },
  Effect.orDie,
  Effect.provide(WebCryptoLayer)
);

/**
 * The keyed hash of a canonical code: HMAC-SHA-256 under the server secret, in
 * hex. Only this hash is stored, so without the secret nobody can check a
 * guessed code against the table. A missing secret is a deployment defect.
 */
export const hashCardCode = Effect.fn("identity.code.hash")(function* (
  code: string
) {
  const secret = yield* Config.Redacted("LOGIN_CARD_SECRET");
  const key = yield* Effect.promise(() =>
    crypto.subtle.importKey(
      "raw",
      encoder.encode(Redacted.value(secret)),
      { hash: "SHA-256", name: "HMAC" },
      false,
      ["sign"]
    )
  );
  const signature = yield* Effect.promise(() =>
    crypto.subtle.sign("HMAC", key, encoder.encode(`${CODE_HASH_LABEL}${code}`))
  );
  return Hex.encode(new Uint8Array(signature));
}, Effect.orDie);
