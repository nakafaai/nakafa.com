import { Array as Arr, pipe, Schema, String as Str } from "effect";

/** The characters of a card code: Crockford base32, which leaves out I, L, O, and U. */
const CODE_ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
/** One character takes one byte. 32 divides 256 evenly, so every character is equally likely. */
const CODE_BYTE_MODULUS = CODE_ALPHABET.length;
/** The characters of one canonical code. */
export const CODE_LENGTH = 10;
const GROUP_LENGTH = 5;

/**
 * A card code as it is stored and compared: ten characters of the alphabet, no
 * dash. The pattern is built from the alphabet and the length, so the two
 * cannot disagree about which characters a code may hold.
 */
const CardCode = Schema.String.check(
  Schema.isPattern(new RegExp(`^[${CODE_ALPHABET}]{${CODE_LENGTH}}$`))
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
