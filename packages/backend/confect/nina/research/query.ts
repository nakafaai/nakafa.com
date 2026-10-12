import { Array as Arr, pipe, String as Str } from "effect";

const whitespacePattern = /\s+/gu;

/**
 * Plans the searches of one research run. The model wrote the queries and
 * understands every language, so each query runs as written: code only trims
 * and collapses its spaces, drops an empty or repeated one (compared without
 * letter case), and stops at `maxQueries`. The search tool refuses a call that
 * holds no usable query, so a plan always has at least one.
 */
export function planSearchQueries({
  maxQueries,
  queries,
}: {
  maxQueries: number;
  queries: readonly string[];
}) {
  return pipe(
    queries,
    Arr.map(collapseSpaces),
    Arr.filter(Str.isNonEmpty),
    Arr.dedupeWith(isSameQuery),
    Arr.take(maxQueries)
  );
}

/** Trims a text and turns every run of spaces and line breaks into one space. */
function collapseSpaces(text: string) {
  return text.trim().replace(whitespacePattern, " ");
}

/** Checks whether two queries differ only by letter case. */
function isSameQuery(left: string, right: string) {
  return left.toLocaleLowerCase() === right.toLocaleLowerCase();
}
