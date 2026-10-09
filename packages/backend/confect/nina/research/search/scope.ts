import { extractDomain } from "@repo/backend/confect/nina/research/domain";
import {
  getDistinctiveSearchTerms,
  hasSearchableTerms,
  normalizedSearchTextHasTerm,
  normalizeSearchTerm,
} from "@repo/backend/confect/nina/research/query";
import type { WebSearchInput } from "@repo/backend/confect/nina/research/schema";
import type { SearchSource } from "@repo/backend/confect/nina/research/search/source";
import { getSourceReferences } from "@repo/backend/confect/nina/research/source";
import { Array as Arr, MutableHashSet, Option } from "effect";

const sourceKeyTokenPattern = /[\p{L}\p{N}][\p{L}\p{N}._-]*/gu;
const sourceKeyWhitespacePattern = /\s+/gu;
const sourceKeyNumericPattern = /^\p{N}+$/u;

/** Keeps adjacent search-result noise out when the top hit matches a specific source phrase. */
export function scopeSources({
  query,
  sourcePreference,
  sources,
  task,
}: {
  query: string;
  sourcePreference: WebSearchInput["sourcePreference"];
  sources: SearchSource[];
  task: string;
}) {
  const taskTerms = getDistinctiveSearchTerms(task);
  const primarySources = getPrimarySources({
    query,
    sourcePreference,
    sources,
    task,
  });

  if (primarySources) {
    return primarySources;
  }

  const terms = getSourceScopeTerms({ query, taskTerms });

  if (!hasSearchableTerms(terms)) {
    return sources;
  }

  if (hasSearchableTerms(taskTerms)) {
    return Arr.filter(sources, (source) => sourceHasTerms(source, terms));
  }

  const firstSource = Arr.head(sources);

  if (Option.isNone(firstSource) || !sourceHasTerms(firstSource.value, terms)) {
    return sources;
  }

  return Arr.filter(sources, (source) => sourceHasTerms(source, terms));
}

/** Prefers first-party product domains when the model detected a primary-source constraint. */
function getPrimarySources({
  query,
  sourcePreference,
  sources,
  task,
}: {
  query: string;
  sourcePreference: WebSearchInput["sourcePreference"];
  sources: SearchSource[];
  task: string;
}) {
  if (sourcePreference !== "primary") {
    return;
  }

  const domainKeys = getPrimaryDomainKeys(`${task} ${query}`);

  if (domainKeys.length === 0) {
    return;
  }

  const primarySources = Arr.filter(sources, (source) =>
    sourceDomainMatchesKeys(source.url, domainKeys)
  );

  if (primarySources.length === 0) {
    return;
  }

  return primarySources;
}

/** Builds compact product keys that can match first-party domains. */
function getPrimaryDomainKeys(text: string) {
  const domainKeys = Arr.map(getSourceReferences(text), (source) =>
    normalizeSourceKey(extractDomain(source.href))
  );
  const productKeys = Arr.flatMap(getDistinctiveSearchTerms(text), (term) => {
    if (sourceKeyNumericPattern.test(term.text)) {
      return [];
    }

    return [normalizeSourceKey(term.text)];
  });
  const versionAdjacentKeys = getVersionAdjacentKeys(text);
  const seen = MutableHashSet.empty<string>();

  return Arr.flatMap(
    [...domainKeys, ...productKeys, ...versionAdjacentKeys],
    (token) => {
      if (token.length < 3) {
        return [];
      }

      if (MutableHashSet.has(seen, token)) {
        return [];
      }

      MutableHashSet.add(seen, token);
      return [token];
    }
  );
}

/** Finds product names that sit next to version numbers such as `React 19`. */
function getVersionAdjacentKeys(text: string) {
  const tokens = Arr.map(
    [...text.matchAll(sourceKeyTokenPattern)],
    (match) => match[0]
  );

  return Arr.flatMap(tokens, (token, index) => {
    if (!sourceKeyNumericPattern.test(token) || token.length < 2) {
      return [];
    }

    return Arr.flatMap(
      [Arr.get(tokens, index - 1), Arr.get(tokens, index + 1)],
      (candidate) => {
        if (
          Option.isNone(candidate) ||
          sourceKeyNumericPattern.test(candidate.value)
        ) {
          return [];
        }

        return [normalizeSourceKey(candidate.value)];
      }
    );
  });
}

/** Normalizes a product or domain fragment for first-party URL comparison. */
function normalizeSourceKey(value: string) {
  return normalizeSearchTerm(value).replace(sourceKeyWhitespacePattern, "");
}

/** Checks whether a source URL belongs to a compact product domain. */
function sourceDomainMatchesKeys(url: string, keys: string[]) {
  const sourceDomain = extractDomain(url);

  if (!sourceDomain) {
    return false;
  }

  const domain = normalizeSourceKey(sourceDomain);
  return Arr.some(keys, (key) => domain.includes(key));
}

/** Prefers source scoping by the original task over generated query variants. */
function getSourceScopeTerms({
  query,
  taskTerms,
}: {
  query: string;
  taskTerms: ReturnType<typeof getDistinctiveSearchTerms>;
}) {
  if (hasSearchableTerms(taskTerms)) {
    return taskTerms;
  }

  return getDistinctiveSearchTerms(query);
}

/** Checks source metadata and selected content for every distinctive term. */
function sourceHasTerms(
  source: SearchSource,
  terms: ReturnType<typeof getDistinctiveSearchTerms>
) {
  const text = normalizeSearchTerm(
    Arr.join(
      [source.title, source.description, source.url, source.content],
      " "
    )
  );

  return Arr.every(terms, (term) => normalizedSearchTextHasTerm(text, term));
}
