import { Array as Arr, String as Str } from "effect";

/**
 * The lines Git writes into a file when a merge stops on a conflict, in their
 * exact forms: an opening `<<<<<<< ` and a closing `>>>>>>> `, each followed
 * by its side's name, the common ancestor's `||||||| ` in the diff3 style, and
 * a bare `=======` between the sides. A file that keeps one was committed
 * before its conflict was resolved.
 */
const OPENING = /^<{7} /u;
const ANCESTOR = /^\|{7} /u;
const CLOSING = /^>{7} /u;
const MIDDLE = /^={7}$/u;

/** The carriage return a Windows line ends with, which never makes a marker any less one. */
const CARRIAGE = /\r$/u;

/** The text files the rule reads: sources, styles, data, configuration and documents. */
export const TEXT_FILE_PATTERN =
  /\.(?:[cm]?[jt]sx?|json|jsonc|mdx?|css|ya?ml|toml|txt|html|svg|sh)$/u;

const MARKER_RULE =
  "resolve the merge conflict this line marks: keep what both sides meant and delete Git's marker lines";

/**
 * Reports each line of a text file that a merge conflict's markers left
 * behind, by its line number. A bare `=======` counts only between an opening
 * marker and its closing one, so a Markdown heading underlined with seven `=`
 * is no conflict.
 */
export function inspectMarkers(file: string, sourceText: string) {
  const lines = Arr.map(Str.split(sourceText, "\n"), Str.replace(CARRIAGE, ""));
  const { found } = Arr.reduce(
    lines,
    { found: Arr.empty<number>(), open: false },
    (state, line, index) => {
      if (OPENING.test(line)) {
        return { found: Arr.append(state.found, index + 1), open: true };
      }
      if (CLOSING.test(line)) {
        return { found: Arr.append(state.found, index + 1), open: false };
      }
      const marked = ANCESTOR.test(line) || (state.open && MIDDLE.test(line));
      return marked
        ? { ...state, found: Arr.append(state.found, index + 1) }
        : state;
    }
  );
  return Arr.map(found, (line) => `${file}:${line}: ${MARKER_RULE}.`);
}
