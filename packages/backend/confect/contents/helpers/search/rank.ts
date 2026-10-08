import type { ContentSearchDocument } from "@repo/backend/confect/contents/helpers/search/groups";
import { Array as Arr, HashSet, Order, pipe } from "effect";

/** Minimal persisted search fields required by deterministic reranking. */
export type ContentSearchRankDocument = Pick<
  ContentSearchDocument,
  | "description"
  | "locale"
  | "route"
  | "section"
  | "sourcePath"
  | "text"
  | "title"
>;
const searchTokenPattern = /[\p{L}\p{N}]+/gu;
const numericTokenPattern = /^\p{N}+$/u;
const routeSeparatorPattern = /[/_-]+/g;

/**
 * Matches the documented full-text semantics for a bounded in-memory row set.
 *
 * Every term except the last must match one complete token. The final term
 * may match a token prefix, mirroring Convex search-as-you-type behavior.
 *
 * @see https://docs.convex.dev/search/text-search
 */
export function matchesContentSearchQuery(text: string, queryText: string) {
  const queryTokens = tokenizeSearchText(queryText);
  if (queryTokens.length === 0) {
    return false;
  }
  const textTokens = HashSet.fromIterable(tokenizeSearchText(text));
  return Arr.every(queryTokens, (token, index) => {
    if (index < queryTokens.length - 1) {
      return HashSet.has(textTokens, token);
    }
    return Arr.some(Arr.fromIterable(textTokens), (candidate) =>
      candidate.startsWith(token)
    );
  });
}

/** Re-ranks bounded search candidates by direct query-token evidence. */
export function rankContentSearchDocuments<
  Document extends ContentSearchRankDocument,
>(documents: readonly Document[], queryText: string) {
  const queryTokens = tokenizeSearchText(queryText);
  const semanticTokens = Arr.filter(
    queryTokens,
    (token) => !numericTokenPattern.test(token)
  );
  const numericTokens = Arr.filter(queryTokens, (token) =>
    numericTokenPattern.test(token)
  );
  if (queryTokens.length === 0) {
    return documents;
  }
  const ranked = pipe(
    Arr.map(documents, (document, index) => ({
      bodyNumericScore: scoreSearchText(document.text, numericTokens),
      bodySemanticScore: scoreSearchText(document.text, semanticTokens),
      document,
      index,
      metadataNumericScore: scoreSearchText(
        getDocumentMetadataSearchText(document),
        numericTokens
      ),
      metadataSemanticScore: scoreSearchText(
        getDocumentMetadataSearchText(document),
        semanticTokens
      ),
    })),
    Arr.sortBy(
      Order.mapInput(
        Order.flip(Order.Number),
        (row) => row.metadataSemanticScore
      ),
      Order.mapInput(Order.flip(Order.Number), (row) => row.bodySemanticScore),
      Order.mapInput(
        Order.flip(Order.Number),
        (row) => row.metadataNumericScore
      ),
      Order.mapInput(Order.flip(Order.Number), (row) => row.bodyNumericScore),
      Order.mapInput(Order.Number, (row) => row.index)
    ),
    Arr.filter(
      (row) =>
        semanticTokens.length <= 1 ||
        row.metadataSemanticScore + row.bodySemanticScore >= 2
    )
  );
  return Arr.map(ranked, (item) => item.document);
}

/** Scores text by how many unique query tokens it directly contains. */
function scoreSearchText(text: string, queryTokens: readonly string[]) {
  const textTokens = HashSet.fromIterable(tokenizeSearchText(text));
  let score = 0;
  for (const token of queryTokens) {
    if (HashSet.has(textTokens, token)) {
      score += 1;
    }
  }
  return score;
}

/** Joins content identity fields before using body text as a tie-breaker. */
function getDocumentMetadataSearchText(document: ContentSearchRankDocument) {
  return Arr.join(
    [document.title, document.description, document.route],
    " "
  ).replaceAll(routeSeparatorPattern, " ");
}

/** Tokenizes multilingual query and document text for deterministic ranking. */
function tokenizeSearchText(value: string) {
  const tokens = value.toLocaleLowerCase().match(searchTokenPattern);
  if (!tokens) {
    return [];
  }
  return Array.from(tokens);
}
