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

  const intro = analyzedParagraphs[0];
  const selectedParts = preserveStructure ? [intro.text] : [];
  let currentLength = preserveStructure ? intro.length + 2 : 0;
  const targetLength = maxLength * TARGET_LENGTH_BUFFER;
  const candidates = preserveStructure
    ? analyzedParagraphs.slice(1, -1)
    : analyzedParagraphs;
  const paragraphLimit = preserveStructure
    ? maxRelevantParagraphs
    : Math.max(minRelevantParagraphs, maxRelevantParagraphs);
  const selectedParagraphs = candidates
    .filter((paragraph) => paragraph.score > 0)
    .sort((left, right) => right.score - left.score)
    .slice(0, paragraphLimit);

  if (preserveStructure) {
    selectedParagraphs.sort((left, right) => left.index - right.index);
  }
  for (const paragraph of selectedParagraphs) {
    if (currentLength + paragraph.length + 2 < targetLength) {
      selectedParts.push(paragraph.text);
      currentLength += paragraph.length + 2;
    }
  }

  const conclusion = analyzedParagraphs.at(-1);
  if (
    preserveStructure &&
    conclusion &&
    currentLength + conclusion.length + 2 < targetLength
  ) {
    selectedParts.push(conclusion.text);
  }

  if (selectedParts.length === 0) {
    return truncateAtBoundary(content, maxLength);
  }

  const result = selectedParts.join("\n\n");
  return truncateAtBoundary(result, maxLength);
}
