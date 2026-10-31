import { Array as Arr, Result, String as Str } from "effect";
import renderA11yString from "katex/contrib/render-a11y-string";
import { Lexer, type Token } from "marked";

/** A formula on its own line, between `$$` delimiters. */
const BLOCK_FORMULA = /\$\$(?<tex>[^$]+)\$\$/gu;

/** A formula inside a line, between `$` delimiters. */
const INLINE_FORMULA = /\$(?<tex>[^$]+)\$/gu;

/** A run of white space, which the spoken words keep as one space. */
const SPACE = /\s+/gu;

/**
 * A formula that is a plain number, such as `10`, `3.14` or `2{,}5`, or one identifier, such as `x`. Its
 * MathML holds the same characters, so a screen reader reads it in its own language.
 */
const PLAIN_FORMULA = /^(?:\d+(?:(?:\{[.,]\}|[.,])\d+)*|[A-Za-z])$/u;

/** The braces of a decimal comma, `{,}`, which a plain number's MathML does not hold. */
const BRACE = /[{}]/gu;

/**
 * A formula as words, with a space on each side. A plain number or identifier keeps the text its MathML
 * holds, so `$10$` stays `10`; structured math takes KaTeX's own reading, in English, since KaTeX speaks no
 * other language; and a formula with a command KaTeX cannot read keeps its TeX.
 */
const spokenFormula = (_formula: string, tex: string) => {
  const formula = Str.trim(tex);
  if (PLAIN_FORMULA.test(formula)) {
    return ` ${formula.replace(BRACE, "")} `;
  }
  return ` ${Result.getOrElse(
    Result.try(() => renderA11yString(formula)),
    () => formula
  )} `;
};

/** The words of Markdown tokens: a token's own tokens where it holds them, else its text. */
const wordsOf = (tokens: readonly Token[]): string =>
  Arr.join(
    Arr.map(tokens, (token) => {
      if ("tokens" in token && Arr.isArray(token.tokens)) {
        return wordsOf(token.tokens);
      }
      return "text" in token && typeof token.text === "string"
        ? token.text
        : "";
    }),
    " "
  );

/**
 * Authored Markdown as the words a screen reader says for it: its words without their marks, with each
 * plain number or identifier as its MathML text and each other formula spoken as KaTeX reads it. A label drawn only as math holds no text an accessible name can read,
 * since its formula is MathML, which counts as embedded content, and its drawing is hidden from assistive
 * technology; these words are what such a label names its control with.
 */
export function spokenText(markdown: string) {
  const spoken = markdown
    .replace(BLOCK_FORMULA, spokenFormula)
    .replace(INLINE_FORMULA, spokenFormula);
  return Str.trim(Str.replaceAll(SPACE, " ")(wordsOf(Lexer.lex(spoken))));
}
