import type { SearchSource } from "@repo/ai/agents/research/search/source";
import {
  getDistinctiveTerms,
  hasSearchableTerms,
  normalizedTextHasTerm,
  normalizeTerm,
} from "@repo/ai/agents/research/search/terms";

/** Keeps adjacent search-result noise out when the top hit matches a specific source phrase. */
export function scopeSources({
  query,
  sources,
  intent,
}: {
  query: string;
  sources: SearchSource[];
  intent: string;
}) {
  const intentTerms = getDistinctiveTerms(intent);
  const terms = getSourceScopeTerms({ query, intentTerms });

  if (!hasSearchableTerms(terms)) {
    return sources;
  }

  if (hasSearchableTerms(intentTerms)) {
    return sources.filter((source) => sourceHasTerms(source, terms));
  }

  const firstSource = sources.at(0);

  if (!(firstSource && sourceHasTerms(firstSource, terms))) {
    return sources;
  }

  return sources.filter((source) => sourceHasTerms(source, terms));
}

/** Prefers source scoping by the original intent over generated query variants. */
function getSourceScopeTerms({
  query,
  intentTerms,
}: {
  query: string;
  intentTerms: ReturnType<typeof getDistinctiveTerms>;
}) {
  if (hasSearchableTerms(intentTerms)) {
    return intentTerms;
  }

  return getDistinctiveTerms(query);
}

/** Checks source metadata and selected content for every distinctive term. */
function sourceHasTerms(
  source: SearchSource,
  terms: ReturnType<typeof getDistinctiveTerms>
) {
  const text = normalizeTerm(
    [source.title, source.description, source.url, source.content].join(" ")
  );

  return terms.every((term) => normalizedTextHasTerm(text, term));
}
