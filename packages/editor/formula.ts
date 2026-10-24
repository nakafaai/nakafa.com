import { Array as Arr, Order, Schema } from "effect";

/**
 * A formula that a text holds between its delimiters: its kind, its LaTeX source without
 * the delimiters and the spaces around it, and the text it was found in, delimiters included.
 * `index` is where that text starts in the searched text.
 */
const FormulaMatchSchema = Schema.Struct({
  index: Schema.Finite,
  kind: Schema.Literals(["block", "inline"]),
  latex: Schema.String,
  text: Schema.String,
});

/** A formula that a text holds, as `findFormulas` finds it. */
type FormulaMatch = typeof FormulaMatchSchema.Type;

/**
 * The delimiters of a block formula: `$$` and `$$`, or `\[` and `\]`. A block formula may
 * stand inside a line, and the paste that converts it decides where it goes.
 */
const BLOCKS = [/\$\$([^$]+)\$\$/g, /\\\[([\s\S]+?)\\\]/g];

/**
 * The delimiters of an inline formula: one `$` and one `$`, or `\(` and `\)`. A line break
 * ends it, so an inline formula stays on its own line.
 */
const INLINES = [/\$([^$\n]+)\$/g, /\\\(([^\n]+?)\\\)/g];

/** The matches of one pattern in a text, each as a formula of the given kind, with a blank formula left out. */
function matchesOf(
  text: string,
  pattern: RegExp,
  kind: FormulaMatch["kind"]
): FormulaMatch[] {
  return Arr.flatMap(Arr.fromIterable(text.matchAll(pattern)), (match) => {
    const latex = match[1].trim();
    return latex === ""
      ? []
      : [{ index: match.index, kind, latex, text: match[0] }];
  });
}

/**
 * The text with each block replaced by line breaks of the block's length. An inline
 * formula cannot cross a line break, so no inline formula reads a block's `$` as its own,
 * and every offset of the text stays where it was.
 */
function withoutBlocks(text: string, blocks: readonly FormulaMatch[]): string {
  return Arr.reduce(
    blocks,
    text,
    (current, block) =>
      current.slice(0, block.index) +
      "\n".repeat(block.text.length) +
      current.slice(block.index + block.text.length)
  );
}

/**
 * The formulas of a text, in the order they start. A block formula is found first, and the
 * inline formulas are found in the text without it. A formula whose LaTeX is blank is no
 * formula, because the contract stores LaTeX that is not empty.
 */
export function findFormulas(text: string): FormulaMatch[] {
  const blocks = Arr.flatMap(BLOCKS, (pattern) =>
    matchesOf(text, pattern, "block")
  );
  const rest = withoutBlocks(text, blocks);
  const inline = Arr.flatMap(INLINES, (pattern) =>
    matchesOf(rest, pattern, "inline")
  );
  return Arr.sort(
    Arr.appendAll(blocks, inline),
    Order.mapInput(Order.Number, (match: FormulaMatch) => match.index)
  );
}
