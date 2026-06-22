import type { WebSearchInput } from "@repo/ai/agents/research/schema";
import type { SearchSource } from "@repo/ai/agents/research/search/source";
import { extractDomain } from "@repo/ai/lib/domain";
import {
  getDistinctiveSearchTerms,
  hasSearchableTerms,
  normalizedSearchTextHasTerm,
  normalizeSearchTerm,
} from "@repo/ai/lib/search-query";
import { getSourceReferences } from "@repo/ai/lib/source";

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
    return sources.filter((source) => sourceHasTerms(source, terms));
  }

  const firstSource = sources.at(0);

  if (!(firstSource && sourceHasTerms(firstSource, terms))) {
    return sources;
  }

  return sources.filter((source) => sourceHasTerms(source, terms));
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

  const primarySources = sources.filter((source) =>
    sourceDomainMatchesKeys(source.url, domainKeys)
  );

  if (primarySources.length === 0) {
    return;
  }

  return primarySources;
}

/** Builds compact product keys that can match first-party domains. */
function getPrimaryDomainKeys(text: string) {
  const domainKeys = getSourceReferences(text).map((source) =>
    normalizeSourceKey(extractDomain(source.href))
  );
  const productKeys = getDistinctiveSearchTerms(text).flatMap((term) => {
    if (sourceKeyNumericPattern.test(term.text)) {
      return [];
    }

    return [normalizeSourceKey(term.text)];
  });
  const versionAdjacentKeys = getVersionAdjacentKeys(text);
  const seen = new Set<string>();

  return [...domainKeys, ...productKeys, ...versionAdjacentKeys].flatMap(
    (token) => {
      if (token.length < 3) {
        return [];
      }

      if (seen.has(token)) {
        return [];
      }

      seen.add(token);
      return [token];
    }
  );
}

/** Finds product names that sit next to version numbers such as `React 19`. */
function getVersionAdjacentKeys(text: string) {
  const tokens = [...text.matchAll(sourceKeyTokenPattern)].map(
    (match) => match[0]
  );

  return tokens.flatMap((token, index) => {
    if (!sourceKeyNumericPattern.test(token) || token.length < 2) {
      return [];
    }

    return [tokens.at(index - 1), tokens.at(index + 1)].flatMap((candidate) => {
      if (!candidate || sourceKeyNumericPattern.test(candidate)) {
        return [];
      }

      return [normalizeSourceKey(candidate)];
    });
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
  return keys.some((key) => domain.includes(key));
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
    [source.title, source.description, source.url, source.content].join(" ")
  );

  return terms.every((term) => normalizedSearchTextHasTerm(text, term));
}
