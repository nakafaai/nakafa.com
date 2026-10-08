import { Array as Arr, MutableHashSet, pipe, Schema } from "effect";

const queryTokenPattern = /[\p{L}\p{N}][\p{L}\p{N}._-]*/gu;
const mixedCasePattern = /\p{Ll}[\p{L}\p{N}._-]*\p{Lu}/u;
const separatorPattern = /[._-]/u;
const numericPattern = /^\p{N}+$/u;
const searchableLineBreakPattern = /\r?\n/u;
const searchWhitespacePattern = /\s+/gu;
const nonSearchCharacterPattern = /[^\p{L}\p{N}]+/gu;
const tokenBoundaryPattern = /^[._-]+|[._-]+$/gu;
const titleCasePattern = /^\p{Lu}[\p{L}\p{N}._-]*$/u;

const PlanSearchQueriesInputSchema = Schema.Struct({
  fallback: Schema.optionalKey(Schema.Literals(["task", "none"])),
  includeShortNumbers: Schema.optionalKey(Schema.Boolean),
  maxQueries: Schema.Finite,
  queries: Schema.Array(Schema.String),
  scopeByNamedPhrases: Schema.optionalKey(Schema.Boolean),
  task: Schema.String,
});
type PlanSearchQueriesInput = typeof PlanSearchQueriesInputSchema.Type;

const DistinctiveSearchTermOptionsSchema = Schema.Struct({
  includeShortNumbers: Schema.optionalKey(Schema.Boolean),
});
type DistinctiveSearchTermOptions =
  typeof DistinctiveSearchTermOptionsSchema.Type;

const NamedSearchPhraseSchema = Schema.Struct({
  normalized: Schema.String,
  text: Schema.String,
});
type NamedSearchPhrase = typeof NamedSearchPhraseSchema.Type;

/** Plans executable search queries without rewriting model-chosen search text. */
export function planSearchQueries({
  fallback = "task",
  includeShortNumbers = false,
  task,
  maxQueries,
  queries,
  scopeByNamedPhrases = false,
}: PlanSearchQueriesInput) {
  const seen = MutableHashSet.empty<string>();
  const executableQueries = Arr.flatMap(queries, (query) => {
    const text = normalizeExecutableSearchQuery(query);

    if (!text) {
      return [];
    }

    return [text];
  });
  const namedPhrases = scopeByNamedPhrases ? getNamedSearchPhrases(task) : [];
  const hasScopedQuery =
    scopeByNamedPhrases &&
    Arr.some(executableQueries, (query) =>
      queryHasNamedPhrase(query, namedPhrases)
    );
  const scopedQueries = hasScopedQuery
    ? preserveScopedQueryContext(executableQueries, namedPhrases)
    : executableQueries;
  const plannedQueries = Arr.flatMap(scopedQueries, (text) =>
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
  const seen = MutableHashSet.empty<string>();

  return Arr.flatMap(tokens, (text, index) => {
    const normalized = normalizeSearchTerm(text);

    if (!normalized || MutableHashSet.has(seen, normalized)) {
      return [];
    }

    if (!isDistinctiveSearchToken(text, index, tokens, options)) {
      return [];
    }

    MutableHashSet.add(seen, normalized);

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

  return pipe(
    taskTerms,
    Arr.map((term) => term.text),
    Arr.join(" ")
  );
}

/** Extracts exact named phrases that should keep search variants scoped. */
function getNamedSearchPhrases(task: string): NamedSearchPhrase[] {
  const runs = Arr.chop(getSearchTokens(getSearchableText(task)), (tokens) => {
    const [run, later] = Arr.splitWhere(
      tokens,
      (token) => !isNamedPhraseToken(token)
    );
    // An empty run starts at a separator token, which the next run skips.
    return [run, Arr.isReadonlyArrayEmpty(run) ? Arr.drop(later, 1) : later];
  });
  const phrases = Arr.filter(
    Arr.flatMap(runs, namedSearchPhrase),
    (phrase) => phrase.normalized !== ""
  );
  return Arr.dedupeWith(
    phrases,
    (left, right) => left.normalized === right.normalized
  );
}

/** Returns a named phrase run when it has enough signal to be source-scoping. */
function namedSearchPhrase(run: readonly string[]): NamedSearchPhrase[] {
  if (run.length < 2 || !Arr.some(run, isSpecificTextToken)) {
    return [];
  }
  const text = Arr.join(run, " ");
  return [{ normalized: normalizeSearchTerm(text), text }];
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

  return Arr.some(namedPhrases, (phrase) =>
    ` ${normalizedQuery} `.includes(` ${phrase.normalized} `)
  );
}

/** Keeps entity-scoped searches from losing numeric/date context. */
function preserveScopedQueryContext(
  queries: readonly string[],
  namedPhrases: ReturnType<typeof getNamedSearchPhrases>
) {
  const scopedQueries = Arr.filter(queries, (query) =>
    queryHasNamedPhrase(query, namedPhrases)
  );
  const droppedQueries = Arr.filter(
    queries,
    (query) => !queryHasNamedPhrase(query, namedPhrases)
  );
  const contextTerms = getDroppedContextTerms(droppedQueries);

  if (contextTerms.length === 0) {
    return scopedQueries;
  }

  return Arr.map(scopedQueries, (query, index) => {
    if (index !== scopedQueries.length - 1) {
      return query;
    }

    return appendMissingContextTerms(query, contextTerms);
  });
}

/** Extracts adjacent date-like context without language-specific month names. */
function getDroppedContextTerms(queries: readonly string[]) {
  const seen = MutableHashSet.empty<string>();

  return Arr.flatMap(queries, (query) => {
    const tokens = getSearchTokens(query);

    return Arr.flatMap(tokens, (text, index) => {
      if (!isContextToken(text, index, tokens)) {
        return [];
      }

      const normalized = normalizeSearchTerm(text);

      if (!normalized || MutableHashSet.has(seen, normalized)) {
        return [];
      }

      MutableHashSet.add(seen, normalized);
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
  const missingTerms = Arr.flatMap(contextTerms, (term) => {
    if (normalizedSearchTextHasTerm(normalizedQuery, term)) {
      return [];
    }

    return [term.text];
  });

  if (missingTerms.length === 0) {
    return query;
  }

  return `${query} ${Arr.join(missingTerms, " ")}`;
}

/** Extracts normalized token text from multilingual search input. */
function getSearchTokens(query: string) {
  return Arr.map([...query.matchAll(queryTokenPattern)], (match) =>
    match[0].replace(tokenBoundaryPattern, "")
  );
}

/** Removes internal Markdown section labels from executable search text. */
function getSearchableText(value: string) {
  const content = pipe(
    value.split(searchableLineBreakPattern),
    Arr.filter((line) => !line.trimStart().startsWith("#")),
    Arr.join("\n")
  ).trim();

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
  seen: MutableHashSet.MutableHashSet<string>;
  text: string;
}) {
  if (!text) {
    return [];
  }

  const key = text.toLocaleLowerCase();

  if (
    MutableHashSet.has(seen, key) ||
    MutableHashSet.size(seen) >= maxQueries
  ) {
    return [];
  }

  MutableHashSet.add(seen, key);
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

  return Arr.some(tokens.slice(0, index), isSpecificTextToken);
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
