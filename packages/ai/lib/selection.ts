const DEFAULT_MAX_LENGTH = 2000;
const MIN_KEYWORD_LENGTH = 3;
const KEYWORD_BONUS_POINTS = 0.5;
const PARAGRAPH_LENGTH_DIVISOR = 100;
const TARGET_LENGTH_BUFFER = 0.9;

const PARAGRAPH_SPLIT_REGEX = /\n\s*\n/;
const SEARCH_TOKEN_REGEX = /[\p{L}\p{N}][\p{L}\p{N}_-]*/gu;
const REGEX_SPECIAL_CHARS = /[.*+?^${}()|[\]\\]/g;

const TRUNCATION_THRESHOLDS = {
  sentence: 0.7,
  paragraph: 0.6,
  newline: 0.7,
  word: 0.8,
} as const;

interface ContentParagraph {
  index: number;
  length: number;
  score: number;
  text: string;
}

interface SelectRelevantContentParams {
  content: string;
  maxLength?: number;
  maxRelevantParagraphs?: number;
  minRelevantParagraphs?: number;
  preserveStructure?: boolean;
  query?: string;
}

/**
 * Extracts searchable terms without assuming the user's language.
 */
function extractKeywords(query: string): string[] {
  const seen = new Set<string>();

  return [...query.toLocaleLowerCase().matchAll(SEARCH_TOKEN_REGEX)].flatMap(
    ([word]) => {
      if (word.length < MIN_KEYWORD_LENGTH || seen.has(word)) {
        return [];
      }

      seen.add(word);
      return [word];
    }
  );
}

/**
 * Scores one paragraph based on language-agnostic term matches.
 */
function calculateRelevanceScore(
  paragraph: string,
  keywords: string[]
): number {
  const lowerParagraph = paragraph.toLocaleLowerCase();
  let score = 0;

  for (const keyword of keywords) {
    const keywordRegex = new RegExp(escapeRegex(keyword), "gu");
    const matches = (lowerParagraph.match(keywordRegex) || []).length;
    score += matches;

    if (lowerParagraph.includes(keyword)) {
      score += KEYWORD_BONUS_POINTS;
    }
  }

  // Normalize by paragraph length to avoid bias towards longer paragraphs
  return score / Math.max(paragraph.length / PARAGRAPH_LENGTH_DIVISOR, 1);
}

/**
 * Escapes a search term before using it in a regular expression.
 */
function escapeRegex(value: string) {
  return value.replace(REGEX_SPECIAL_CHARS, "\\$&");
}

/**
 * Truncates source text at a readable boundary when possible.
 */
function truncateAtBoundary(text: string, maxLength: number): string {
  if (text.length <= maxLength) {
    return text;
  }

  const truncated = text.slice(0, maxLength);

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
        truncated.slice(0, cutPoint) + (boundary.type === "word" ? "..." : "")
      );
    }
  }

  return `${truncated}...`;
}

/**
 * Selects and combines source paragraphs most relevant to the research query.
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

  if (content.length <= maxLength) {
    return content;
  }

  if (!query.trim()) {
    return truncateAtBoundary(content, maxLength);
  }

  const keywords = extractKeywords(query);
  if (keywords.length === 0) {
    return truncateAtBoundary(content, maxLength);
  }

  const paragraphs = content
    .split(PARAGRAPH_SPLIT_REGEX)
    .map((p) => p.trim())
    .filter(Boolean);

  if (paragraphs.length <= 2) {
    return truncateAtBoundary(content, maxLength);
  }

  const analyzedParagraphs: ContentParagraph[] = paragraphs.map(
    (text, index) => ({
      text,
      score: calculateRelevanceScore(text, keywords),
      index,
      length: text.length,
    })
  );

  const selectedParts: string[] = [];
  let currentLength = 0;
  const targetLength = maxLength * TARGET_LENGTH_BUFFER;

  if (preserveStructure) {
    const intro = analyzedParagraphs[0];
    selectedParts.push(intro.text);
    currentLength += intro.length + 2;

    const middleParagraphs = analyzedParagraphs
      .slice(1, -1)
      .filter((p) => p.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, maxRelevantParagraphs);

    const sortedMiddleParagraphs = middleParagraphs.sort(
      (a, b) => a.index - b.index
    );
    for (const paragraph of sortedMiddleParagraphs) {
      if (currentLength + paragraph.length + 2 < targetLength) {
        selectedParts.push(paragraph.text);
        currentLength += paragraph.length + 2;
      }
    }

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

  if (selectedParts.length === 0) {
    return truncateAtBoundary(content, maxLength);
  }

  const result = selectedParts.join("\n\n");
  return truncateAtBoundary(result, maxLength);
}
