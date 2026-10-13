import { HashMap, Option, String as Str } from "effect";

/**
 * Reads the references that the editor's Markdown writer puts in text, as the
 * editor reads them: `decodeHtmlEntities` of `@tiptap/core`. The editor's own
 * function cannot be imported here, because `@tiptap/core` is one module that
 * brings about 85 kB gzipped into the first JavaScript of a page, and the page
 * that lists the memories reads them without the editor. `references.test.ts`
 * sets this reader against the editor's.
 */

/** The characters the writer puts in place of `&`, `<` and `>`, and the one it reads for `"`. */
const NAMED = HashMap.make(
  ["amp", "&"],
  ["gt", ">"],
  ["lt", "<"],
  ["quot", '"']
);

/** What a numeric reference between 128 and 159 stands for, as HTML5 reads it. */
const WINDOWS = HashMap.make(
  [0x80, 0x20_ac],
  [0x82, 0x20_1a],
  [0x83, 0x01_92],
  [0x84, 0x20_1e],
  [0x85, 0x20_26],
  [0x86, 0x20_20],
  [0x87, 0x20_21],
  [0x88, 0x02_c6],
  [0x89, 0x20_30],
  [0x8a, 0x01_60],
  [0x8b, 0x20_39],
  [0x8c, 0x01_52],
  [0x8e, 0x01_7d],
  [0x91, 0x20_18],
  [0x92, 0x20_19],
  [0x93, 0x20_1c],
  [0x94, 0x20_1d],
  [0x95, 0x20_22],
  [0x96, 0x20_13],
  [0x97, 0x20_14],
  [0x98, 0x02_dc],
  [0x99, 0x21_22],
  [0x9a, 0x01_61],
  [0x9b, 0x20_3a],
  [0x9c, 0x01_53],
  [0x9e, 0x01_7e],
  [0x9f, 0x01_78]
);

/** The character a numeric reference stands for, or the replacement character for a value that is none. */
function characterOf(value: number) {
  if (
    value === 0 ||
    value > 0x10_ff_ff ||
    (value >= 0xd8_00 && value <= 0xdf_ff)
  ) {
    return "�";
  }

  return String.fromCodePoint(
    Option.getOrElse(HashMap.get(WINDOWS, value), () => value)
  );
}

/** What one reference such as `&amp;`, `&#38;` or `&#x26;` stands for. */
function resolve(reference: string) {
  const body = Str.slice(1, -1)(reference);
  const named = HashMap.get(NAMED, body);

  if (Option.isSome(named)) {
    return named.value;
  }

  const hexadecimal = Str.startsWith("#x")(body) || Str.startsWith("#X")(body);

  return characterOf(
    Number.parseInt(Str.slice(hexadecimal ? 2 : 1)(body), hexadecimal ? 16 : 10)
  );
}

/** The references the editor reads: a number of one to seven digits, in decimal or in hexadecimal, and four names. */
const REFERENCE = /&(?:#[0-9]{1,7}|#[xX][0-9a-fA-F]{1,6}|amp|gt|lt|quot);/g;

/**
 * Reads the references in text, in one pass, so that what a reference stands
 * for is never read as a reference again: `&amp;lt;` is the text `&lt;`. These
 * are the references the editor reads, and no others.
 */
export function decodeReferences(text: string) {
  return text.replaceAll(REFERENCE, resolve);
}
