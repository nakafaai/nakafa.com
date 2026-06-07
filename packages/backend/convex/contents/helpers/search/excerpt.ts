const EXCERPT_CONTEXT_RADIUS = 90;
const EXCERPT_MAX_LENGTH = 220;
const TOKEN_PATTERN = /[\p{L}\p{N}]+/gu;
const WHITESPACE_PATTERN = /\s+/g;

interface ContentSearchExcerptSource {
  description: string;
  text: string;
}

/** Builds a plain-text search excerpt without HTML markup. */
export function buildContentSearchExcerpt(
  document: ContentSearchExcerptSource,
  queryTexts: readonly string[]
) {
  const tokens = getUniqueQueryTokens(queryTexts);
  const text = normalizeText(document.text);

  if (tokens.length === 0) {
    return truncateExcerpt(normalizeText(document.description) || text);
  }

  const matchIndex = getFirstTokenIndex(text, tokens);

  if (matchIndex === -1) {
    return truncateExcerpt(normalizeText(document.description) || text);
  }

  return sliceExcerpt(text, matchIndex);
}

/** Extracts deduplicated search terms from the query variants. */
function getUniqueQueryTokens(queryTexts: readonly string[]) {
  const tokens: string[] = [];
  const seen = new Set<string>();

  for (const queryText of queryTexts) {
    const matches = queryText.matchAll(TOKEN_PATTERN);

    for (const match of matches) {
      const token = match[0].toLowerCase();

      if (seen.has(token)) {
        continue;
      }

      seen.add(token);
      tokens.push(token);
    }
  }

  return tokens;
}

/** Collapses whitespace so excerpts stay compact and deterministic. */
function normalizeText(value: string) {
  return value.replace(WHITESPACE_PATTERN, " ").trim();
}

/** Finds the earliest occurrence of any query token in normalized text. */
function getFirstTokenIndex(text: string, tokens: readonly string[]) {
  const lowerText = text.toLowerCase();
  let firstIndex = -1;

  for (const token of tokens) {
    const index = lowerText.indexOf(token);

    if (index === -1) {
      continue;
    }

    if (firstIndex === -1 || index < firstIndex) {
      firstIndex = index;
    }
  }

  return firstIndex;
}

/** Truncates unmatched fallback text to the configured excerpt length. */
function truncateExcerpt(text: string) {
  if (text.length <= EXCERPT_MAX_LENGTH) {
    return text;
  }

  return `${text.slice(0, EXCERPT_MAX_LENGTH).trim()}...`;
}

/** Slices a contextual excerpt around the first matched token. */
function sliceExcerpt(text: string, matchIndex: number) {
  if (text.length <= EXCERPT_MAX_LENGTH) {
    return text;
  }

  const roughStart = Math.max(0, matchIndex - EXCERPT_CONTEXT_RADIUS);
  const start = getExcerptStart(text, roughStart);
  const end = getExcerptEnd(text, start + EXCERPT_MAX_LENGTH);
  const prefix = start > 0 ? "..." : "";
  const suffix = end < text.length ? "..." : "";

  return `${prefix}${text.slice(start, end).trim()}${suffix}`;
}

/** Moves an excerpt start to a nearby word boundary when available. */
function getExcerptStart(text: string, start: number) {
  if (start === 0) {
    return 0;
  }

  const nextSpace = text.indexOf(" ", start);

  if (nextSpace === -1 || nextSpace > start + 30) {
    return start;
  }

  return nextSpace + 1;
}

/** Moves an excerpt end to a nearby word boundary when available. */
function getExcerptEnd(text: string, end: number) {
  if (end >= text.length) {
    return text.length;
  }

  const previousSpace = text.lastIndexOf(" ", end);

  if (previousSpace === -1 || previousSpace < end - 30) {
    return end;
  }

  return previousSpace;
}
