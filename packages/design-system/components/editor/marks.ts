import type { MarkdownTokenizer } from "@tiptap/core";
import { Function as Fn, Option } from "effect";
import type { TokenizerExtension } from "marked-tiptap";

/**
 * The two marks of the editor that Markdown has no syntax for. The editor writes
 * underlined words between two plus signs and highlighted words between two
 * equals signs. The editor and the page's reader lex them with this one rule,
 * so neither can read a mark where the other reads words.
 *
 * A mark is a pair around words: the opening delimiter is followed by a word,
 * and the closing one follows a word. A lone `C++`, a `==` between two words, and
 * a pair with a space inside it, such as the `++ and C++` of `C++ and C++20`, are
 * only text. The editor never writes a space inside the delimiters: it writes
 * the space of marked words outside them.
 */
const MARKS = {
  highlight: { delimiter: "==", pair: /^==(?=[^\s=])([^=]*[^\s=])==/ },
  underline: { delimiter: "++", pair: /^\+\+(?=\S)([\s\S]*?\S)\+\+/ },
} as const;

type Mark = keyof typeof MARKS;

/**
 * Reads the mark of the kind `mark` that starts `src`, or none when `src` does
 * not start with a pair around words. `raw` is the pair with its delimiters and
 * `words` is what is between them.
 */
export function markAt(mark: Mark, src: string) {
  return Option.fromNullishOr(MARKS[mark].pair.exec(src)).pipe(
    Option.map(([raw, words]) => ({ raw, words }))
  );
}

/** The tokenizer that the editor's extension for `mark` lexes the Markdown with. */
export function markTokenizer(mark: Mark): MarkdownTokenizer {
  return {
    level: "inline",
    name: mark,
    start: (src) => src.indexOf(MARKS[mark].delimiter),
    tokenize: (src, _tokens, lexer) =>
      Option.match(markAt(mark, src), {
        onNone: Fn.constUndefined,
        onSome: ({ raw, words }) => ({
          raw,
          text: words,
          tokens: lexer.inlineTokens(words),
          type: mark,
        }),
      }),
  };
}

/** The extension that makes a `marked` lex `mark`, as the editor does. */
export function markExtension(mark: Mark): TokenizerExtension {
  return {
    level: "inline",
    name: mark,
    start: (src) => src.indexOf(MARKS[mark].delimiter),
    tokenizer(src) {
      return Option.match(markAt(mark, src), {
        onNone: Fn.constUndefined,
        onSome: ({ raw, words }) => ({
          raw,
          text: words,
          tokens: this.lexer.inlineTokens(words),
          type: mark,
        }),
      });
    },
  };
}
