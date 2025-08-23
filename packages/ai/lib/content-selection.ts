/**
 * Advanced content selection and truncation utilities
 * Combines smart boundary detection with query-based relevance scoring
 */

// Configuration constants
const DEFAULT_MAX_LENGTH = 2000;
const MIN_KEYWORD_LENGTH = 3;
const KEYWORD_BONUS_POINTS = 0.5;
const PARAGRAPH_LENGTH_DIVISOR = 100;
const TARGET_LENGTH_BUFFER = 0.9;

// Regex patterns for content processing
const PUNCTUATION_REGEX = /[^\w\s]/g;
const WHITESPACE_REGEX = /\s+/;
const PARAGRAPH_SPLIT_REGEX = /\n\s*\n/;

// Smart truncation thresholds for boundary detection
const TRUNCATION_THRESHOLDS = {
  sentence: 0.7, // Use sentence boundary if 70% or more of max length
  paragraph: 0.6, // Use paragraph boundary if 60% or more of max length
  newline: 0.7, // Use newline boundary if 70% or more of max length
  word: 0.8, // Use word boundary if 80% or more of max length
} as const;

// Common stop words to filter out from keyword extraction
const STOP_WORDS = new Set([
  "what",
  "when",
  "where",
  "which",
  "how",
  "why",
  "does",
  "with",
  "from",
  "about",
  "that",
  "this",
  "they",
  "them",
  "their",
  "there",
  "then",
  "than",
  "have",
  "been",
  "will",
  "would",
  "could",
  "should",
  "might",
  "must",
  "can",
  "do",
  "did",
  "don",
  "are",
  "was",
  "were",
  "is",
  "am",
  "be",
  "being",
]);

type ContentParagraph = {
  text: string;
  score: number;
  index: number;
  length: number;
};

type SelectRelevantContentParams = {
  content: string;
  query?: string;
  maxLength?: number;
  preserveStructure?: boolean;
  minRelevantParagraphs?: number;
  maxRelevantParagraphs?: number;
};

/**
 * Extract meaningful keywords from a query string
 */
function extractKeywords(query: string): string[] {
  return query
    .toLowerCase()
    .replace(PUNCTUATION_REGEX, " ") // Replace punctuation with spaces
    .split(WHITESPACE_REGEX)
    .filter((word) => word.length >= MIN_KEYWORD_LENGTH)
    .filter((word) => !STOP_WORDS.has(word))
    .filter(Boolean);
}

/**
 * Calculate relevance score for a paragraph based on keyword matches
 */
function calculateRelevanceScore(
  paragraph: string,
  keywords: string[]
): number {
  if (keywords.length === 0) {
    return 0;
  }

  const lowerParagraph = paragraph.toLowerCase();
  let score = 0;

  for (const keyword of keywords) {
    // Create regex for this keyword to count occurrences
    const keywordRegex = new RegExp(keyword, "g");
    const matches = (lowerParagraph.match(keywordRegex) || []).length;
    score += matches;

    // Bonus points for exact phrase matches
    if (lowerParagraph.includes(keyword)) {
      score += KEYWORD_BONUS_POINTS;
    }
  }

  // Normalize by paragraph length to avoid bias towards longer paragraphs
  return score / Math.max(paragraph.length / PARAGRAPH_LENGTH_DIVISOR, 1);
}

/**
 * Smart truncation with boundary detection
 */
function truncateAtBoundary(text: string, maxLength: number): string {
  if (text.length <= maxLength) {
    return text;
  }

  const truncated = text.substring(0, maxLength);

  // Try different boundaries in order of preference
  const boundaries = [
    {
      type: "sentence",
      pattern: ". ",
      threshold: TRUNCATION_THRESHOLDS.sentence,
    },
    {
      type: "paragraph",
      pattern: "\n\n",
      threshold: TRUNCATION_THRESHOLDS.paragraph,
    },
    {
      type: "newline",
      pattern: "\n",
      threshold: TRUNCATION_THRESHOLDS.newline,
    },
    { type: "word", pattern: " ", threshold: TRUNCATION_THRESHOLDS.word },
  ];

  for (const boundary of boundaries) {
    const lastIndex = truncated.lastIndexOf(boundary.pattern);
    if (lastIndex > maxLength * boundary.threshold) {
      const cutPoint = boundary.type === "sentence" ? lastIndex + 1 : lastIndex;
      return (
        truncated.substring(0, cutPoint) +
        (boundary.type === "word" ? "..." : "")
      );
    }
  }

  // Fallback: hard truncation with ellipsis
  return `${truncated}...`;
}

/**
 * Select and combine the most relevant content based on query and constraints
 */
export function selectRelevantContent(
  params: SelectRelevantContentParams
): string {
  const {
    content,
    query = "",
    maxLength = DEFAULT_MAX_LENGTH,
    preserveStructure = true,
    minRelevantParagraphs = 1,
    maxRelevantParagraphs = 3,
  } = params;

  if (!content.trim()) {
    return "";
  }

  // If no query provided, use smart truncation
  if (!query.trim()) {
    return truncateAtBoundary(content, maxLength);
  }

  const keywords = extractKeywords(query);
  if (keywords.length === 0) {
    return truncateAtBoundary(content, maxLength);
  }

  // Split content into paragraphs
  const paragraphs = content
    .split(PARAGRAPH_SPLIT_REGEX)
    .map((p) => p.trim())
    .filter(Boolean);

  if (paragraphs.length <= 2) {
    return truncateAtBoundary(content, maxLength);
  }

  // Analyze paragraphs for relevance
  const analyzedParagraphs: ContentParagraph[] = paragraphs.map(
    (text, index) => ({
      text,
      score: calculateRelevanceScore(text, keywords),
      index,
      length: text.length,
    })
  );

  // Structure-aware selection
  const selectedParts: string[] = [];
  let currentLength = 0;
  const targetLength = maxLength * TARGET_LENGTH_BUFFER; // Leave some buffer for ellipsis

  if (preserveStructure) {
    // Always include introduction (first paragraph)
    const intro = analyzedParagraphs[0];
    selectedParts.push(intro.text);
    currentLength += intro.length + 2; // +2 for paragraph separator

    // Select relevant middle paragraphs
    const middleParagraphs = analyzedParagraphs
      .slice(1, -1)
      .filter((p) => p.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, maxRelevantParagraphs);

    // Sort back to original order and add if space allows
    const sortedMiddleParagraphs = middleParagraphs.sort(
      (a, b) => a.index - b.index
    );
    for (const paragraph of sortedMiddleParagraphs) {
      if (currentLength + paragraph.length + 2 < targetLength) {
        selectedParts.push(paragraph.text);
        currentLength += paragraph.length + 2;
      }
    }

    // Include conclusion if there's space and it exists
    const conclusion = analyzedParagraphs.at(-1);
    if (
      conclusion &&
      conclusion.index !== intro.index &&
      currentLength + conclusion.length + 2 < targetLength
    ) {
      selectedParts.push(conclusion.text);
      currentLength += conclusion.length + 2;
    }
  } else {
    // Just select most relevant paragraphs regardless of structure
    const relevantParagraphs = analyzedParagraphs
      .filter((p) => p.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, Math.max(minRelevantParagraphs, maxRelevantParagraphs));

    for (const paragraph of relevantParagraphs) {
      if (currentLength + paragraph.length + 2 < targetLength) {
        selectedParts.push(paragraph.text);
        currentLength += paragraph.length + 2;
      }
    }
  }

  // Combine and ensure final length constraint
  const result = selectedParts.join("\n\n");
  return truncateAtBoundary(result, maxLength);
}

/**
 * Simple truncation function for backward compatibility
 */
export function truncateContent(
  content: string,
  maxLength: number = DEFAULT_MAX_LENGTH
): string {
  return selectRelevantContent({
    content,
    maxLength,
    preserveStructure: false,
  });
}

/**
 * Get content length statistics
 */
export function getContentStats(content: string): {
  totalLength: number;
  paragraphCount: number;
  averageParagraphLength: number;
} {
  const paragraphs = content
    .split(PARAGRAPH_SPLIT_REGEX)
    .filter((p) => p.trim());

  return {
    totalLength: content.length,
    paragraphCount: paragraphs.length,
    averageParagraphLength:
      paragraphs.length > 0
        ? Math.round(content.length / paragraphs.length)
        : 0,
  };
}
