const queryTokenPattern = /[\p{L}\p{N}][\p{L}\p{N}._-]*/gu;
const mixedCasePattern = /\p{Ll}[\p{L}\p{N}._-]*\p{Lu}/u;
const separatorPattern = /[._-]/u;

/** Extracts high-signal query terms without a product-specific allowlist. */
export function getDistinctiveTerms(query: string) {
  const seen = new Set<string>();

  return [...query.matchAll(queryTokenPattern)].flatMap((match) => {
    const text = match[0].replace(/^[._-]+|[._-]+$/gu, "");

    if (!isDistinctiveTerm(text)) {
      return [];
    }

    const normalized = normalizeTerm(text);

    if (!normalized || seen.has(normalized)) {
      return [];
    }

    seen.add(normalized);

    return [{ normalized, text }];
  });
}

/** Keeps one-term source names when the term shape is specific enough for search. */
export function hasSearchableTerms(
  terms: ReturnType<typeof getDistinctiveTerms>
) {
  if (terms.length > 1) {
    return true;
  }

  const term = terms.at(0)?.text;

  if (!term) {
    return false;
  }

  if (separatorPattern.test(term) || mixedCasePattern.test(term)) {
    return true;
  }

  return normalizeTerm(term).replace(/\s+/gu, "").length >= 3;
}

/** Checks normalized text with token boundaries instead of raw substrings. */
export function normalizedTextHasTerm(
  normalizedText: string,
  term: ReturnType<typeof getDistinctiveTerms>[number]
) {
  return ` ${normalizedText} `.includes(` ${term.normalized} `);
}

/** Normalizes query/source text for term containment checks. */
export function normalizeTerm(value: string) {
  return value
    .toLocaleLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

/** Detects acronym, mixed-case, dotted, hyphenated, or underscored terms. */
function isDistinctiveTerm(term: string) {
  const uppercaseLetters = term.match(/\p{Lu}/gu) ?? [];

  if (uppercaseLetters.length >= 2) {
    return true;
  }

  if (mixedCasePattern.test(term)) {
    return true;
  }

  return separatorPattern.test(term) && term.length > 2;
}
