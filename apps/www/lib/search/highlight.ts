import { Array as Arr, MutableList } from "effect";

const HIGHLIGHT_TOKEN_LIMIT = 8;
const TOKEN_PATTERN = /[\p{L}\p{N}]+/gu;

export type SearchExcerptPart = ReturnType<typeof createPart>;

/** Returns whether one Convex excerpt contains visible text. */
export function hasSearchExcerpt(excerpt: string) {
  return excerpt.trim().length > 0;
}

/** Splits one plain-text excerpt into safe highlighted text parts. */
export function getSearchExcerptParts(excerpt: string, query: string) {
  const tokens = getHighlightTokens(query);

  if (tokens.length === 0) {
    return [createPart({ highlighted: false, start: 0, text: excerpt })];
  }

  const parts = MutableList.make<SearchExcerptPart>();
  const pattern = new RegExp(
    `(${Arr.join(Arr.map(tokens, escapeRegExp), "|")})`,
    "giu"
  );
  let lastIndex = 0;

  for (const match of excerpt.matchAll(pattern)) {
    const [text] = match;
    const index = match.index;

    if (index > lastIndex) {
      MutableList.append(
        parts,
        createPart({
          highlighted: false,
          start: lastIndex,
          text: excerpt.slice(lastIndex, index),
        })
      );
    }

    MutableList.append(
      parts,
      createPart({ highlighted: true, start: index, text })
    );
    lastIndex = index + text.length;
  }

  if (lastIndex < excerpt.length) {
    MutableList.append(
      parts,
      createPart({
        highlighted: false,
        start: lastIndex,
        text: excerpt.slice(lastIndex),
      })
    );
  }

  return parts.length > 0
    ? MutableList.toArray(parts)
    : [createPart({ highlighted: false, start: 0, text: excerpt })];
}

/** Creates one stable keyed text part for excerpt highlighting. */
function createPart({
  highlighted,
  start,
  text,
}: {
  highlighted: boolean;
  start: number;
  text: string;
}) {
  return {
    highlighted,
    key: getPartKey(start, text),
    text,
  };
}

/** Builds a deterministic key from the part offset and text. */
function getPartKey(start: number, text: string) {
  return `${start}:${text}`;
}

/** Extracts distinct query tokens used for excerpt highlighting. */
function getHighlightTokens(query: string) {
  const tokens = Arr.map(
    Arr.fromIterable(query.matchAll(TOKEN_PATTERN)),
    ([token]) => token.toLowerCase()
  );

  return Arr.take(Arr.dedupe(tokens), HIGHLIGHT_TOKEN_LIMIT);
}

/** Escapes a query token before building the highlight pattern. */
function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
