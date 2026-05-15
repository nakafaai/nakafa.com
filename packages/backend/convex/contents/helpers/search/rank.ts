import type { Doc } from "@repo/backend/convex/_generated/dataModel";

type ContentSearchDocument = Doc<"contentSearch">;

const searchTokenPattern = /[\p{L}\p{N}]+/gu;

/** Re-ranks bounded search candidates by direct query-token evidence. */
export function rankContentSearchDocuments(
  documents: readonly ContentSearchDocument[],
  queryText: string
) {
  const queryTokens = tokenizeSearchText(queryText);

  if (queryTokens.length === 0) {
    return documents;
  }

  return documents
    .map((document, index) => ({
      bodyScore: scoreSearchText(document.text, queryTokens),
      document,
      index,
      metadataScore: scoreSearchText(
        getDocumentMetadataSearchText(document),
        queryTokens
      ),
    }))
    .sort((left, right) => {
      if (left.metadataScore !== right.metadataScore) {
        return right.metadataScore - left.metadataScore;
      }

      if (left.bodyScore !== right.bodyScore) {
        return right.bodyScore - left.bodyScore;
      }

      return left.index - right.index;
    })
    .map((ranked) => ranked.document);
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
function getDocumentMetadataSearchText(document: ContentSearchDocument) {
  return [document.title, document.description, document.route].join(" ");
}

/** Tokenizes multilingual query and document text for deterministic ranking. */
function tokenizeSearchText(value: string) {
  const tokens = value.toLocaleLowerCase().match(searchTokenPattern);

  if (!tokens) {
    return [];
  }

  return Array.from(tokens);
}
