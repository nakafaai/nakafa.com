import { webSearchMaxQueries } from "@repo/ai/agents/research/schema";
import {
  getDistinctiveTerms,
  hasSearchableTerms,
  normalizedTextHasTerm,
  normalizeTerm,
} from "@repo/ai/agents/research/search/terms";

/** Normalizes model-generated search queries while preserving the research intent. */
export function getSearchQueries({
  queries,
  intent,
}: {
  queries: readonly string[];
  intent: string;
}) {
  const seen = new Set<string>();
  const intentTerms = getDistinctiveTerms(intent);
  const intentAnchorQuery = getIntentAnchorQuery(intentTerms);
  const searchInputs = intentAnchorQuery
    ? [intentAnchorQuery, ...queries]
    : queries;

  return searchInputs.flatMap((query) => {
    const text = completeSearchQuery({
      query: query.trim(),
      intentTerms,
    });

    if (!text) {
      return [];
    }

    const key = text.toLocaleLowerCase();

    if (seen.has(key) || seen.size >= webSearchMaxQueries) {
      return [];
    }

    seen.add(key);
    return [text];
  });
}

/** Builds one concise source/topic anchor from exact intent terms. */
function getIntentAnchorQuery(
  intentTerms: ReturnType<typeof getDistinctiveTerms>
) {
  if (!hasSearchableTerms(intentTerms)) {
    return;
  }

  return intentTerms.map((term) => term.text).join(" ");
}

/** Keeps optimized queries anchored to exact high-signal terms from the intent. */
function completeSearchQuery({
  query,
  intentTerms,
}: {
  query: string;
  intentTerms: ReturnType<typeof getDistinctiveTerms>;
}) {
  if (!(query && hasSearchableTerms(intentTerms))) {
    return query;
  }

  const normalizedQuery = normalizeTerm(query);

  if (
    intentTerms.every((term) => normalizedTextHasTerm(normalizedQuery, term))
  ) {
    return query;
  }

  const missingTerms = intentTerms.filter(
    (term) => !normalizedTextHasTerm(normalizedQuery, term)
  );

  return `${missingTerms.map((term) => term.text).join(" ")} ${query}`;
}
