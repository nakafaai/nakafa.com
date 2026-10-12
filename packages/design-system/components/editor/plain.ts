import { Array as Arr, HashMap, Match, Option, String as Str } from "effect";
import { Marked, type Token, type TokenizerExtension } from "marked-tiptap";

/**
 * Reads the Markdown the editor writes as the words the editor shows, so a row
 * of the list and the search say what the editor says for the same memory. It
 * lexes with the lexer the editor lexes with, `marked-tiptap`, which is the
 * very `marked` that `@tiptap/markdown` depends on. The other `marked` of this
 * package lexes differently: from version 18 it decodes numeric references in
 * text, among other rules. The words are read from what the lexer finds the way
 * the editor's own nodes do, so the two cannot disagree on what is a mark, a
 * list, or a character that only looks like one. `plain.test.ts` proves it
 * against the editor and names the few texts where the two still differ.
 *
 * The editor's own package cannot be imported here: it brings the whole editor
 * into the first JavaScript of any page that only lists the words.
 */

/**
 * A mark of the editor that has no CommonMark syntax, written `delimiter`,
 * words, `delimiter`. `rule` is the rule of the editor's own extension for it:
 * a lone delimiter, as in `C++` or `a == b`, is only text.
 */
function mark(
  name: string,
  delimiter: string,
  rule: RegExp
): TokenizerExtension {
  return {
    level: "inline",
    name,
    start: (src) => src.indexOf(delimiter),
    tokenizer(src) {
      const match = rule.exec(src);

      if (match === null) {
        return;
      }

      const [raw] = match;
      const inner = Str.trim(
        Str.slice(delimiter.length, -delimiter.length)(raw)
      );

      return {
        raw,
        text: inner,
        tokens: this.lexer.inlineTokens(inner),
        type: name,
      };
    },
  };
}

/** One reader for the page, whose rules no editor can change. */
const reader = new Marked({
  extensions: [
    // The rules of @tiptap/extension-underline and @tiptap/extension-highlight.
    mark("underline", "++", /^\+\+[\s\S]+?\+\+/),
    mark("highlight", "==", /^==[^=]+==/),
  ],
});

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
 * Reads the references the writer puts in text, in one pass, so that what a
 * reference stands for is never read as a reference again: `&amp;lt;` is the
 * text `&lt;`. These are the references the editor reads, and no others.
 */
function decode(text: string) {
  return text.replaceAll(REFERENCE, resolve);
}

/**
 * Whether the tokens of a paragraph are only the marker of an empty paragraph,
 * a non-breaking space, which the editor writes for the second blank line in a
 * row and reads back as no words.
 */
function isEmptyMarker(tokens: readonly Token[]) {
  return (
    Arr.length(tokens) === 1 &&
    Option.exists(
      Arr.head(tokens),
      (only) =>
        only.type === "text" && (only.text === "&nbsp;" || only.text === " ")
    )
  );
}

/**
 * What a token says as words, in the order the editor shows them. The editor
 * shows a code block, a code span and an escaped character as they are, other
 * text without the references that stand for `&`, `<` and `>`, and a divider,
 * a check box and a table as nothing. The parts of a quote and of a list stand
 * apart, as paragraphs do, and the parts of a line run together.
 */
function read(token: Token): string {
  return Match.value(token).pipe(
    Match.when({ type: "br" }, () => " "),
    Match.when({ type: "html" }, ({ raw }) => raw),
    Match.whenOr(
      { type: "code" },
      { type: "codespan" },
      { type: "escape" },
      ({ text }) => text
    ),
    Match.when({ type: "list" }, ({ items }) => join(items, " ")),
    Match.whenOr({ type: "blockquote" }, { type: "list_item" }, ({ tokens }) =>
      join(tokens, " ")
    ),
    Match.when({ type: "paragraph" }, ({ tokens }) =>
      isEmptyMarker(tokens) ? "" : join(tokens, "")
    ),
    Match.when({ type: "text" }, ({ text, tokens }) =>
      tokens === undefined ? decode(text) : join(tokens, "")
    ),
    // A heading, a mark, a link and an image say what is inside them.
    Match.orElse((other) =>
      "tokens" in other && Arr.isArray(other.tokens)
        ? join(other.tokens, "")
        : ""
    )
  );
}

/** Joins what each token says, with `separator` between the parts. */
function join(tokens: readonly Token[], separator: string) {
  return Arr.join(Arr.map(tokens, read), separator);
}

/**
 * Reads the Markdown of a memory as one line of the words the editor shows for
 * it: no mark of formatting, list, quote or code block, a link without its
 * address, and every run of space as a single space.
 */
export function plainText(markdown: string) {
  return Str.trim(
    Str.replaceAll(/\s+/g, " ")(join(reader.lexer(markdown), " "))
  );
}
