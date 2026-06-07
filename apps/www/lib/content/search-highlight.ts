const HIGHLIGHT_TOKEN_LIMIT = 8;
const TOKEN_PATTERN = /[\p{L}\p{N}]+/gu;

export interface SearchExcerptPart {
  highlighted: boolean;
  key: string;
  text: string;
}

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

  const parts: SearchExcerptPart[] = [];
  const pattern = new RegExp(`(${tokens.map(escapeRegExp).join("|")})`, "giu");
  let lastIndex = 0;

  for (const match of excerpt.matchAll(pattern)) {
    const [text] = match;
    const index = match.index;

    if (index > lastIndex) {
      parts.push(
        createPart({
          highlighted: false,
          start: lastIndex,
          text: excerpt.slice(lastIndex, index),
        })
      );
    }

    parts.push(createPart({ highlighted: true, start: index, text }));
    lastIndex = index + text.length;
  }

  if (lastIndex < excerpt.length) {
    parts.push(
      createPart({
        highlighted: false,
        start: lastIndex,
        text: excerpt.slice(lastIndex),
      })
    );
  }

  return parts.length > 0
    ? parts
    : [createPart({ highlighted: false, start: 0, text: excerpt })];
}

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

function getPartKey(start: number, text: string) {
  return `${start}:${text}`;
}

function getHighlightTokens(query: string) {
  const tokens: string[] = [];
  const seen = new Set<string>();

  for (const match of query.matchAll(TOKEN_PATTERN)) {
    const token = match[0].toLowerCase();

    if (seen.has(token)) {
      continue;
    }

    seen.add(token);
    tokens.push(token);

    if (tokens.length === HIGHLIGHT_TOKEN_LIMIT) {
      break;
    }
  }

  return tokens;
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
