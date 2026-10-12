import { Array as Arr, pipe, String as Str } from "effect";

/**
 * The most characters the task text may take as a search query: the search
 * provider documents its `query` with `maxLength: 500` (Firecrawl search
 * endpoint, read on 12 October 2026). The model writes short queries, so only
 * the task text can come near it. A character is a whole code point, so a cut
 * never splits one.
 */
const SEARCH_QUERY_MAX_LENGTH = 500;

const lineBreakPattern = /\r?\n/u;
const whitespacePattern = /\s+/gu;

/**
 * Plans the searches of one research run. The model wrote the queries and
 * understands every language, so each query runs as written: code only trims
 * and collapses its spaces, drops an empty or repeated one (compared without
 * letter case), and stops at `maxQueries`. When the model wrote no usable
 * query, the one search is the task itself.
 */
export function planSearchQueries({
  maxQueries,
  queries,
  task,
}: {
  maxQueries: number;
  queries: readonly string[];
  task: string;
}) {
  const written = pipe(
    queries,
    Arr.map(collapseSpaces),
    Arr.filter(Str.isNonEmpty)
  );
  const candidates = written.length > 0 ? written : taskQueries(task);

  return pipe(candidates, Arr.dedupeWith(isSameQuery), Arr.take(maxQueries));
}

/**
 * Reads the task as the one fallback query, or as none when it holds no text.
 * The lines that start with `#` are section labels this codebase writes into a
 * task, not the learner's words, so they stay out.
 */
function taskQueries(task: string) {
  const text = pipe(
    task.split(lineBreakPattern),
    Arr.filter((line) => !line.trimStart().startsWith("#")),
    Arr.join(" "),
    collapseSpaces,
    (collapsed) => Arr.take(collapsed, SEARCH_QUERY_MAX_LENGTH),
    Arr.join(""),
    Str.trimEnd
  );

  return Str.isNonEmpty(text) ? [text] : [];
}

/** Trims a text and turns every run of spaces and line breaks into one space. */
function collapseSpaces(text: string) {
  return text.trim().replace(whitespacePattern, " ");
}

/** Checks whether two queries differ only by letter case. */
function isSameQuery(left: string, right: string) {
  return left.toLocaleLowerCase() === right.toLocaleLowerCase();
}
