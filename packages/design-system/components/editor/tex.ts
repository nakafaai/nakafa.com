import { type MathViews, mathExtensions } from "@repo/editor/math";
import type {
  AnyExtension,
  JSONContent,
  MarkdownToken,
  MarkdownTokenizer,
} from "@tiptap/core";
import { Array as Arr, Function as Fn, Option, Schema } from "effect";

/**
 * The formulas of learner text as Markdown writes them, the form the page's reader lexes: remark-math
 * with `singleDollarTextMath` off reads `$$...$$` inside a line as a formula of that line, and a pair of
 * `$$` fences on lines of their own as a formula on its own line. A formula holds no dollar sign and
 * starts and ends with a character that is no space, so a price such as `$$5` stays words.
 */
const FORMULAS = {
  mathBlock: /^\$\$[ \t]*\n(?<latex>[^$]*?\S[^$]*?)\n\$\$[ \t]*(?:\n|$)/u,
  mathInline: /^\$\$(?=\S)(?<latex>[^$]*?\S)\$\$/u,
} as const;

type Formula = keyof typeof FORMULAS;

/** Where a fence of a formula on its own lines may open: `$$` at the start of a line, then the line's end. */
const BLOCK_START = /(?:^|\n)(?=\$\$[ \t]*\n)/u;

/**
 * Where each kind of formula may start in the source the lexer has left. A block's start only names a line
 * that opens a fence, because the lexer breaks its text at every start a block names, and a break inside a
 * line would split the line's words, and an inline formula in them, in two.
 */
const STARTS: Record<Formula, (src: string) => number> = {
  mathBlock: (src) =>
    Option.match(Option.fromNullishOr(BLOCK_START.exec(src)), {
      onNone: () => -1,
      onSome: (match) => match.index + match[0].length,
    }),
  mathInline: (src) => src.indexOf("$$"),
};

/** Reads the formula of the kind `formula` that starts `src`, or none when `src` does not start with one. */
export function formulaAt(formula: Formula, src: string) {
  return Option.fromNullishOr(FORMULAS[formula].exec(src)).pipe(
    Option.flatMap(([raw, latex]) =>
      Option.map(Option.fromNullishOr(latex), (value) => ({
        latex: value,
        raw,
      }))
    )
  );
}

/** The tokenizer that the editor lexes the Markdown of one kind of formula with. */
function formulaTokenizer(formula: Formula): MarkdownTokenizer {
  return {
    level: formula === "mathInline" ? "inline" : "block",
    name: formula,
    start: STARTS[formula],
    tokenize: (src) =>
      Option.match(formulaAt(formula, src), {
        onNone: Fn.constUndefined,
        onSome: ({ latex, raw }) => ({ latex, raw, type: formula }),
      }),
  };
}

/** A formula node as the editor writes it: its LaTeX is its one attribute. */
const FormulaNode = Schema.Struct({
  attrs: Schema.Struct({ latex: Schema.String }),
});

/** The LaTeX of a formula node. */
const latexOf = (node: JSONContent) =>
  Schema.decodeUnknownSync(FormulaNode)(node).attrs.latex;

/** How one kind of formula reads from and writes to Markdown. */
const MARKDOWN = {
  mathBlock: {
    markdownTokenizer: formulaTokenizer("mathBlock"),
    parseMarkdown: (token: MarkdownToken) => ({
      attrs: { latex: token.latex },
      type: "mathBlock",
    }),
    renderMarkdown: (node: JSONContent) => `$$\n${latexOf(node)}\n$$`,
  },
  mathInline: {
    markdownTokenizer: formulaTokenizer("mathInline"),
    parseMarkdown: (token: MarkdownToken) => ({
      attrs: { latex: token.latex },
      type: "mathInline",
    }),
    renderMarkdown: (node: JSONContent) => `$$${latexOf(node)}$$`,
  },
};

/**
 * The formulas of an editor that keeps Markdown: the two formula nodes of the documents, drawn by the given
 * views, with the paste that makes them and the command that turns words into a formula and back, each node
 * reading and writing the Markdown the page's reader lexes.
 */
export function markdownFormulas(views: MathViews): AnyExtension[] {
  return Arr.map(mathExtensions(views), (extension) =>
    extension.name === "mathInline" || extension.name === "mathBlock"
      ? extension.extend(MARKDOWN[extension.name])
      : extension
  );
}
