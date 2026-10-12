import { markExtension } from "@repo/design-system/components/editor/marks";
import { decodeReferences } from "@repo/design-system/components/editor/references";
import { Array as Arr, Match, Option, String as Str } from "effect";
import { Lexer, Marked, type Token, type Tokens } from "marked-tiptap";

/**
 * Reads the Markdown the editor writes as the words the editor shows, so a row
 * of the list and the search say what the editor says for the same memory. The
 * reader and the editor lex with the very same `marked`, which `@tiptap/markdown`
 * depends on and this package declares as `marked-tiptap`: the `marked` of the
 * chat renderer is a later major, which decodes numeric references in text,
 * among other rules. Both lex a mark with the one rule of `marks.ts`, and a
 * numbered list with `marked` itself, as they lex a bullet list
 * (`extensions.ts`), so they share the grammar of every block and mark but the
 * task list, which the editor lexes with a tokenizer of its own. The words are
 * read from what the lexer finds the way the editor's own nodes read it.
 *
 * `plain.test.ts` sets the reader against the editor, for every block and mark
 * the editor writes around the worst-case words and for the ways a line of
 * Markdown can start. It also names what the two still read another way: raw
 * HTML, a text in which the editor finds no block it can hold, and a few shapes
 * that Tiptap bends to its schema or to its task list.
 *
 * The editor's own package cannot be imported here: it brings the whole editor
 * into the first JavaScript of any page that only lists the words.
 */

/** One reader for the page, whose rules no editor can change. */
const reader = new Marked({
  extensions: [markExtension("underline"), markExtension("highlight")],
});

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
 * Whether a list item is only a numbered list that starts on the line of the
 * item's own marker, as `- 1. word` is. `marked` reads a list in the item, and
 * the editor keeps the number as the first word of the item's text: Tiptap's
 * list item extension makes this exception.
 */
function isNumberedText({ text, tokens }: Tokens.ListItem) {
  return (
    Arr.length(tokens) === 1 &&
    Option.exists(
      Arr.head(tokens),
      (only) => only.type === "list" && only.ordered && only.raw === text
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
    Match.when({ type: "list_item" }, (item) =>
      isNumberedText(item)
        ? join(Lexer.lexInline(item.text, reader.defaults), "")
        : join(item.tokens, " ")
    ),
    Match.when({ type: "blockquote" }, ({ tokens }) => join(tokens, " ")),
    Match.when({ type: "paragraph" }, ({ tokens }) =>
      isEmptyMarker(tokens) ? "" : join(tokens, "")
    ),
    Match.when({ type: "text" }, ({ text, tokens }) =>
      tokens === undefined ? decodeReferences(text) : join(tokens, "")
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
