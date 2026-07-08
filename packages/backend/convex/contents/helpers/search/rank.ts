import type { Doc } from "@repo/backend/convex/_generated/dataModel";

/** Minimal persisted search fields required by deterministic reranking. */
export type ContentSearchRankDocument = Pick<
  Doc<"contentSearch">,
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

/** Re-ranks bounded search candidates by direct query-token evidence. */
export function rankContentSearchDocuments<
  Document extends ContentSearchRankDocument,
>(documents: readonly Document[], queryText: string) {
  const queryTokens = tokenizeSearchText(queryText);
  const semanticTokens = queryTokens.filter(
    (token) => !numericTokenPattern.test(token)
  );
  const numericTokens = queryTokens.filter((token) =>
    numericTokenPattern.test(token)
  );

  if (queryTokens.length === 0) {
    return documents;
  }

  const ranked = documents
    .map((document, index) => ({
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
    }))
    .sort((left, right) => {
      if (left.metadataSemanticScore !== right.metadataSemanticScore) {
        return right.metadataSemanticScore - left.metadataSemanticScore;
      }

      if (left.bodySemanticScore !== right.bodySemanticScore) {
        return right.bodySemanticScore - left.bodySemanticScore;
      }

      if (left.metadataNumericScore !== right.metadataNumericScore) {
        return right.metadataNumericScore - left.metadataNumericScore;
      }

      if (left.bodyNumericScore !== right.bodyNumericScore) {
        return right.bodyNumericScore - left.bodyNumericScore;
      }

      return left.index - right.index;
    })
    .filter(
      (ranked) =>
        semanticTokens.length <= 1 ||
        ranked.metadataSemanticScore + ranked.bodySemanticScore >= 2
    );

  return ranked.map((item) => item.document);
}

/** Scores text by how many unique query tokens it directly contains. */
function scoreSearchText(text: string, queryTokens: readonly string[]) {
  const textTokens = new Set(tokenizeSearchText(text));
  let score = 0;

  for (const token of queryTokens) {
    if (textTokens.has(token)) {
      score += 1;
    }
  }

  return score;
}

/** Joins content identity fields before using body text as a tie-breaker. */
function getDocumentMetadataSearchText(document: ContentSearchRankDocument) {
  return [document.title, document.description, document.route]
    .join(" ")
    .replaceAll(routeSeparatorPattern, " ");
}

/** Tokenizes multilingual query and document text for deterministic ranking. */
function tokenizeSearchText(value: string) {
  const tokens = value.toLocaleLowerCase().match(searchTokenPattern);

  if (!tokens) {
    return [];
  }

  return Array.from(tokens);
}
