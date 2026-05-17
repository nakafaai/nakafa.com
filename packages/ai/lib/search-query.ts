const queryTokenPattern = /[\p{L}\p{N}][\p{L}\p{N}._-]*/gu;
const mixedCasePattern = /\p{Ll}[\p{L}\p{N}._-]*\p{Lu}/u;
const separatorPattern = /[._-]/u;
const numericPattern = /^\p{N}+$/u;
const searchableLineBreakPattern = /\r?\n/u;
const searchWhitespacePattern = /\s+/gu;
const nonSearchCharacterPattern = /[^\p{L}\p{N}]+/gu;
const tokenBoundaryPattern = /^[._-]+|[._-]+$/gu;

interface PlanSearchQueriesInput {
  anchor: "always" | "empty" | "never";
  complete?: "all" | "empty-only" | "matching";
  includeShortNumbers?: boolean;
  maxQueries: number;
  queries: readonly string[];
  task: string;
}

interface DistinctiveSearchTermOptions {
  includeShortNumbers?: boolean;
}

/** Plans executable search queries while preserving exact distinctive task terms. */
export function planSearchQueries({
  anchor,
  complete = "all",
  includeShortNumbers = false,
  task,
  maxQueries,
  queries,
}: PlanSearchQueriesInput) {
  const searchableTask = getSearchableText(task);
  const taskTerms = getDistinctiveSearchTerms(searchableTask, {
    includeShortNumbers,
  });
  const anchorQuery =
    anchor === "always"
      ? getExactPhraseAnchorQuery(searchableTask, taskTerms)
      : getTaskAnchorQuery(taskTerms);
  const searchInputs =
    anchorQuery && shouldUseAnchor(anchor, queries)
      ? [
          { complete: false, text: anchorQuery },
          ...queries.map((query) => ({ complete: true, text: query })),
        ]
      : queries.map((query) => ({ complete: true, text: query }));
  const seen = new Set<string>();

  return searchInputs.flatMap((query) => {
    const text = query.complete
      ? getExecutableSearchQuery(query.text.trim(), taskTerms, complete)
      : query.text.trim();

    if (!text) {
      return [];
    }

    const key = text.toLocaleLowerCase();

    if (seen.has(key) || seen.size >= maxQueries) {
      return [];
    }

    seen.add(key);
    return [text];
  });
}

/** Applies the configured completion policy to one executable search query. */
function getExecutableSearchQuery(
  query: string,
  taskTerms: ReturnType<typeof getDistinctiveSearchTerms>,
  complete: NonNullable<PlanSearchQueriesInput["complete"]>
) {
  if (complete === "empty-only") {
    return query;
  }

  if (complete === "matching") {
    return completeMatchingSearchQuery(query, taskTerms);
  }

  return completeSearchQuery(query, taskTerms);
}

/** Completes a scoped query from the first shared nonnumeric exact term onward. */
function completeMatchingSearchQuery(
  query: string,
  taskTerms: ReturnType<typeof getDistinctiveSearchTerms>
) {
  if (!query) {
    return query;
  }

  const normalizedQuery = normalizeSearchTerm(query);
  const firstMatchingTermIndex = taskTerms.findIndex(
    (term) =>
      !isNumericTerm(term.text) &&
      normalizedSearchTextHasTerm(normalizedQuery, term)
  );

  if (firstMatchingTermIndex === -1) {
    return query;
  }

  return completeSearchQuery(query, taskTerms.slice(firstMatchingTermIndex));
}

/** Extracts exact high-signal search terms without language-specific keywords. */
export function getDistinctiveSearchTerms(
  query: string,
  options: DistinctiveSearchTermOptions = {}
) {
  const tokens = getSearchTokens(getSearchableText(query));
  const seen = new Set<string>();

  return tokens.flatMap((text, index) => {
    const normalized = normalizeSearchTerm(text);

    if (!normalized || seen.has(normalized)) {
      return [];
    }

    if (!isDistinctiveSearchToken(text, index, tokens, options)) {
      return [];
    }

    seen.add(normalized);

    return [{ normalized, text }];
  });
}

/** Keeps one-term source names when the term shape is specific enough. */
export function hasSearchableTerms(
  terms: ReturnType<typeof getDistinctiveSearchTerms>
) {
  if (terms.length > 1) {
    return true;
  }

  const term = terms.at(0)?.text;

  if (!term) {
    return false;
  }

  if (isNumericTerm(term)) {
    return false;
  }

  if (separatorPattern.test(term) || mixedCasePattern.test(term)) {
    return true;
  }

  return (
    normalizeSearchTerm(term).replace(searchWhitespacePattern, "").length >= 3
  );
}

/** Checks normalized text with token boundaries instead of raw substrings. */
export function normalizedSearchTextHasTerm(
  normalizedText: string,
  term: ReturnType<typeof getDistinctiveSearchTerms>[number]
) {
  return ` ${normalizedText} `.includes(` ${term.normalized} `);
}

/** Normalizes query/source text for term containment checks. */
export function normalizeSearchTerm(value: string) {
  return value
    .toLocaleLowerCase()
    .replace(nonSearchCharacterPattern, " ")
    .trim();
}

/** Builds one concise anchor query from exact task terms. */
function getTaskAnchorQuery(
  taskTerms: ReturnType<typeof getDistinctiveSearchTerms>
) {
  if (!hasSearchableTerms(taskTerms)) {
    return;
  }

  return taskTerms.map((term) => term.text).join(" ");
}

/** Builds a compact research anchor around exact product, feature, and version terms. */
function getExactPhraseAnchorQuery(
  task: string,
  taskTerms: ReturnType<typeof getDistinctiveSearchTerms>
) {
  if (!hasSearchableTerms(taskTerms)) {
    return;
  }

  const anchorText = [
    ...getSearchableLines(task).filter((line) =>
      hasSearchableTerms(getDistinctiveSearchTerms(line))
    ),
    task,
  ][0];
  const tokens = getSearchTokens(anchorText);
  const termIndexes = tokens.flatMap((token, index) => {
    const normalized = normalizeSearchTerm(token);

    if (taskTerms.some((term) => term.normalized === normalized)) {
      return [index];
    }

    return [];
  });

  const firstIndex = Math.min(...termIndexes);
  let lastIndex = Math.min(firstIndex + 3, tokens.length - 1);
  const nextToken = tokens.at(lastIndex + 1);

  if (nextToken && isNumericTerm(nextToken)) {
    lastIndex += 1;
  }

  return tokens.slice(firstIndex, lastIndex + 1).join(" ");
}

/** Decides whether the anchor should be executed as its own search query. */
function shouldUseAnchor(
  anchor: PlanSearchQueriesInput["anchor"],
  queries: readonly string[]
) {
  if (anchor === "always") {
    return true;
  }

  return anchor === "empty" && queries.length === 0;
}

/** Keeps optimized queries anchored to exact high-signal terms from the task. */
function completeSearchQuery(
  query: string,
  taskTerms: ReturnType<typeof getDistinctiveSearchTerms>
) {
  if (!(query && hasSearchableTerms(taskTerms))) {
    return query;
  }

  const normalizedQuery = normalizeSearchTerm(query);
  const missingTerms = taskTerms.filter(
    (term) => !normalizedSearchTextHasTerm(normalizedQuery, term)
  );

  if (missingTerms.length === 0) {
    return query;
  }

  return `${missingTerms.map((term) => term.text).join(" ")} ${query}`;
}

/** Extracts normalized token text from multilingual search input. */
function getSearchTokens(query: string) {
  return [...query.matchAll(queryTokenPattern)].map((match) =>
    match[0].replace(tokenBoundaryPattern, "")
  );
}

/** Removes internal Markdown section labels from executable search text. */
function getSearchableText(value: string) {
  const content = value
    .split(searchableLineBreakPattern)
    .filter((line) => !line.trimStart().startsWith("#"))
    .join("\n")
    .trim();

  if (!content) {
    return value;
  }

  return content;
}

/** Splits executable search text into non-empty content lines. */
function getSearchableLines(value: string) {
  return getSearchableText(value)
    .split(searchableLineBreakPattern)
    .map((line) => line.trim())
    .filter(Boolean);
}

/** Detects acronym, mixed-case, numeric, dotted, hyphenated, or underscored terms. */
function isDistinctiveSearchToken(
  token: string,
  index: number,
  tokens: readonly string[],
  options: DistinctiveSearchTermOptions
) {
  if (isNumericTerm(token)) {
    return isDistinctiveNumber(token, index, tokens, options);
  }

  return isSpecificTextToken(token);
}

/** Keeps numeric discriminators that look like versions, years, sets, or question ids. */
function isDistinctiveNumber(
  token: string,
  index: number,
  tokens: readonly string[],
  options: DistinctiveSearchTermOptions
) {
  if (token.length > 1) {
    return true;
  }

  if (!options.includeShortNumbers) {
    return false;
  }

  return tokens.slice(0, index).some(isSpecificTextToken);
}

/** Detects nonnumeric terms that are specific enough to anchor a short number. */
function isSpecificTextToken(token: string) {
  const uppercaseLetters = token.match(/\p{Lu}/gu) ?? [];

  if (uppercaseLetters.length >= 2) {
    return true;
  }

  if (mixedCasePattern.test(token)) {
    return true;
  }

  return separatorPattern.test(token) && token.length > 2;
}

/** Checks whether a token is made only of numbers. */
function isNumericTerm(token: string) {
  return numericPattern.test(token);
}
