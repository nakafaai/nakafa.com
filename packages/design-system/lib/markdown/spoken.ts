import { Array as Arr, Result, String as Str } from "effect";
import renderA11yString from "katex/contrib/render-a11y-string";
import { Lexer, type Token } from "marked";

/** A formula on its own line, between `$$` delimiters. */
const BLOCK_FORMULA = /\$\$([^$]+)\$\$/g;

/** A formula inside a line, between `$` delimiters. */
const INLINE_FORMULA = /\$([^$]+)\$/g;

/** A run of white space, which the spoken words keep as one space. */
const SPACE = /\s+/g;

/**
 * A formula as words, with a space on each side: KaTeX's own reading of it, or its TeX where KaTeX cannot
 * read a command of it.
 */
const spokenFormula = (_formula: string, tex: string) =>
  ` ${Result.getOrElse(
    Result.try(() => renderA11yString(tex)),
    () => tex
  )} `;

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
 * formula spoken as KaTeX reads it. A label drawn only as math holds no text an accessible name can read,
 * since its formula is MathML, which counts as embedded content, and its drawing is hidden from assistive
 * technology; these words are what such a label names its control with.
 */
export function spokenText(markdown: string) {
  const spoken = markdown
    .replace(BLOCK_FORMULA, spokenFormula)
    .replace(INLINE_FORMULA, spokenFormula);
  return Str.trim(Str.replaceAll(SPACE, " ")(wordsOf(Lexer.lex(spoken))));
}
