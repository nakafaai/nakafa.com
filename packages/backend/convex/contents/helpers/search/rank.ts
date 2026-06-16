import type { Doc } from "@repo/backend/convex/_generated/dataModel";

type ContentSearchDocument = Doc<"contentSearch">;

const searchTokenPattern = /[\p{L}\p{N}]+/gu;
const numericTokenPattern = /^\p{N}+$/u;
const exerciseQuestionRoutePattern = /\/question-\d+$/u;
const practiceRoutePrefix = "material/practice/";
const routeSeparatorPattern = /[/_-]+/g;

/** Re-ranks bounded search candidates by direct query-token evidence. */
export function rankContentSearchDocuments(
  documents: readonly ContentSearchDocument[],
  queryText: string
) {
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
      setPriority: getExerciseSetPriority(document),
    }))
    .sort((left, right) => {
      if (left.metadataSemanticScore !== right.metadataSemanticScore) {
        return right.metadataSemanticScore - left.metadataSemanticScore;
      }

      if (left.setPriority !== right.setPriority) {
        return right.setPriority - left.setPriority;
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
function getDocumentMetadataSearchText(document: ContentSearchDocument) {
  return [document.title, document.description, document.route]
    .join(" ")
    .replaceAll(routeSeparatorPattern, " ");
}

/** Prefers set/material exercise rows over question rows for semantic searches. */
function getExerciseSetPriority(document: ContentSearchDocument) {
  if (
    document.section !== "material" ||
    !document.route.startsWith(practiceRoutePrefix)
  ) {
    return 0;
  }

  if (exerciseQuestionRoutePattern.test(document.route)) {
    return 0;
  }

  return 1;
}

/** Tokenizes multilingual query and document text for deterministic ranking. */
function tokenizeSearchText(value: string) {
  const tokens = value.toLocaleLowerCase().match(searchTokenPattern);

  if (!tokens) {
    return [];
  }

  return Array.from(tokens);
}
