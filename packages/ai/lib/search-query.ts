const queryTokenPattern = /[\p{L}\p{N}][\p{L}\p{N}._-]*/gu;
const mixedCasePattern = /\p{Ll}[\p{L}\p{N}._-]*\p{Lu}/u;
const separatorPattern = /[._-]/u;
const numericPattern = /^\p{N}+$/u;
const searchableLineBreakPattern = /\r?\n/u;
const searchWhitespacePattern = /\s+/gu;
const nonSearchCharacterPattern = /[^\p{L}\p{N}]+/gu;
const tokenBoundaryPattern = /^[._-]+|[._-]+$/gu;
const titleCasePattern = /^\p{Lu}[\p{L}\p{N}._-]*$/u;

interface PlanSearchQueriesInput {
  fallback?: "task" | "none";
  includeShortNumbers?: boolean;
  maxQueries: number;
  queries: readonly string[];
  scopeByNamedPhrases?: boolean;
  task: string;
}

interface DistinctiveSearchTermOptions {
  includeShortNumbers?: boolean;
}

interface NamedSearchPhrase {
  normalized: string;
  text: string;
}

/** Plans executable search queries without rewriting model-chosen search text. */
export function planSearchQueries({
  fallback = "task",
  includeShortNumbers = false,
  task,
  maxQueries,
  queries,
  scopeByNamedPhrases = false,
}: PlanSearchQueriesInput) {
  const seen = new Set<string>();
  const executableQueries = queries.flatMap((query) => {
    const text = normalizeExecutableSearchQuery(query);

    if (!text) {
      return [];
    }

    return [text];
  });
  const namedPhrases = scopeByNamedPhrases ? getNamedSearchPhrases(task) : [];
  const hasScopedQuery =
    scopeByNamedPhrases &&
    executableQueries.some((query) => queryHasNamedPhrase(query, namedPhrases));
  const scopedQueries = hasScopedQuery
    ? preserveScopedQueryContext(executableQueries, namedPhrases)
    : executableQueries;
  const plannedQueries = scopedQueries.flatMap((text) =>
    appendSearchQuery({ maxQueries, seen, text })
  );

  if (plannedQueries.length > 0 || fallback === "none") {
    return plannedQueries;
  }

  const taskTerms = getDistinctiveSearchTerms(getSearchableText(task), {
    includeShortNumbers,
  });
  const taskQuery = getTaskAnchorQuery(taskTerms);

  return appendSearchQuery({ maxQueries, seen, text: taskQuery ?? "" });
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

/** Extracts exact named phrases that should keep search variants scoped. */
function getNamedSearchPhrases(task: string) {
  const tokens = getSearchTokens(getSearchableText(task));
  const phrases: NamedSearchPhrase[] = [];
  const seen = new Set<string>();
  let run: string[] = [];

  for (const token of tokens) {
    if (isNamedPhraseToken(token)) {
      run.push(token);
      continue;
    }

    appendNamedSearchPhrase({ phrases, run, seen });
    run = [];
  }

  appendNamedSearchPhrase({ phrases, run, seen });

  return phrases;
}

/** Adds a named phrase run when it has enough signal to be source-scoping. */
function appendNamedSearchPhrase({
  phrases,
  run,
  seen,
}: {
  phrases: NamedSearchPhrase[];
  run: string[];
  seen: Set<string>;
}) {
  if (run.length < 2) {
    return;
  }

  if (!run.some(isSpecificTextToken)) {
    return;
  }

  const text = run.join(" ");
  const normalized = normalizeSearchTerm(text);

  if (!(normalized && !seen.has(normalized))) {
    return;
  }

  seen.add(normalized);
  phrases.push({ normalized, text });
}

/** Checks whether a query preserves at least one task-level named phrase. */
function queryHasNamedPhrase(
  query: string,
  namedPhrases: ReturnType<typeof getNamedSearchPhrases>
) {
  if (namedPhrases.length === 0) {
    return false;
  }

  const normalizedQuery = normalizeSearchTerm(query);

  return namedPhrases.some((phrase) =>
    ` ${normalizedQuery} `.includes(` ${phrase.normalized} `)
  );
}

/** Keeps entity-scoped searches from losing numeric/date context. */
function preserveScopedQueryContext(
  queries: readonly string[],
  namedPhrases: ReturnType<typeof getNamedSearchPhrases>
) {
  const scopedQueries = queries.filter((query) =>
    queryHasNamedPhrase(query, namedPhrases)
  );
  const droppedQueries = queries.filter(
    (query) => !queryHasNamedPhrase(query, namedPhrases)
  );
  const contextTerms = getDroppedContextTerms(droppedQueries);

  if (contextTerms.length === 0) {
    return scopedQueries;
  }

  return scopedQueries.map((query, index) => {
    if (index !== scopedQueries.length - 1) {
      return query;
    }

    return appendMissingContextTerms(query, contextTerms);
  });
}

/** Extracts adjacent date-like context without language-specific month names. */
function getDroppedContextTerms(queries: readonly string[]) {
  const seen = new Set<string>();

  return queries.flatMap((query) => {
    const tokens = getSearchTokens(query);

    return tokens.flatMap((text, index) => {
      if (!isContextToken(text, index, tokens)) {
        return [];
      }

      const normalized = normalizeSearchTerm(text);

      if (!normalized || seen.has(normalized)) {
        return [];
      }

      seen.add(normalized);
      return [{ normalized, text }];
    });
  });
}

/** Preserves numbers plus title-case tokens between nearby numbers. */
function isContextToken(
  token: string,
  index: number,
  tokens: readonly string[]
) {
  if (isNumericTerm(token)) {
    return true;
  }

  return (
    titleCasePattern.test(token) &&
    (isNumericTerm(tokens[index - 1] ?? "") ||
      isNumericTerm(tokens[index + 1] ?? ""))
  );
}

/** Adds only missing context terms to the chosen scoped query. */
function appendMissingContextTerms(
  query: string,
  contextTerms: ReturnType<typeof getDroppedContextTerms>
) {
  const normalizedQuery = normalizeSearchTerm(query);
  const missingTerms = contextTerms.flatMap((term) => {
    if (normalizedSearchTextHasTerm(normalizedQuery, term)) {
      return [];
    }

    return [term.text];
  });

  if (missingTerms.length === 0) {
    return query;
  }

  return `${query} ${missingTerms.join(" ")}`;
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

/** Normalizes one executable query without changing its meaning. */
function normalizeExecutableSearchQuery(query: string) {
  return query.trim().replace(searchWhitespacePattern, " ");
}

/** Appends one query if it is non-empty, unique, and within the query limit. */
function appendSearchQuery({
  maxQueries,
  seen,
  text,
}: {
  maxQueries: number;
  seen: Set<string>;
  text: string;
}) {
  if (!text) {
    return [];
  }

  const key = text.toLocaleLowerCase();

  if (seen.has(key) || seen.size >= maxQueries) {
    return [];
  }

  seen.add(key);
  return [text];
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

/** Keeps acronym/product tokens plus adjacent title-case words in one phrase. */
function isNamedPhraseToken(token: string) {
  return isSpecificTextToken(token) || titleCasePattern.test(token);
}

/** Checks whether a token is made only of numbers. */
function isNumericTerm(token: string) {
  return numericPattern.test(token);
}
