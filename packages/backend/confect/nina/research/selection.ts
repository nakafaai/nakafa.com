import { Array as Arr, HashSet, Option, Order, pipe, Schema } from "effect";

const DEFAULT_MAX_LENGTH = 2000;
const KEYWORD_BONUS_POINTS = 0.5;
const PARAGRAPH_LENGTH_DIVISOR = 100;
const TARGET_LENGTH_BUFFER = 0.9;

const PARAGRAPH_SPLIT_REGEX = /\n\s*\n/;

const TRUNCATION_THRESHOLDS = {
  sentence: 0.7,
  paragraph: 0.6,
  newline: 0.7,
  word: 0.8,
} as const;

const ContentParagraphSchema = Schema.Struct({
  index: Schema.Finite,
  length: Schema.Finite,
  score: Schema.Finite,
  text: Schema.String,
});
type ContentParagraph = typeof ContentParagraphSchema.Type;

const SelectRelevantContentParamsSchema = Schema.Struct({
  content: Schema.String,
  maxLength: Schema.optionalKey(Schema.Finite),
  maxRelevantParagraphs: Schema.optionalKey(Schema.Finite),
  minRelevantParagraphs: Schema.optionalKey(Schema.Finite),
  preserveStructure: Schema.optionalKey(Schema.Boolean),
  query: Schema.optionalKey(Schema.String),
});
type SelectRelevantContentParams =
  typeof SelectRelevantContentParamsSchema.Type;

/**
 * Splits a text into its lowercased words the way the platform does, with no
 * minimum length and no list of words to skip. The platform finds the word
 * breaks of every script, also of those written without spaces.
 */
function readWords(segmenter: Intl.Segmenter, text: string) {
  return Arr.flatMap(Arr.fromIterable(segmenter.segment(text)), (part) =>
    part.isWordLike ? [part.segment.toLocaleLowerCase()] : []
  );
}

/**
 * Scores one paragraph by the task words it holds: every occurrence counts,
 * and every different task word it holds earns a bonus. The score is taken per
 * hundred characters, so a long paragraph does not win by its length alone.
 */
function calculateRelevanceScore(
  paragraph: string,
  keywords: HashSet.HashSet<string>,
  segmenter: Intl.Segmenter
): number {
  const matches = Arr.filter(readWords(segmenter, paragraph), (word) =>
    HashSet.has(keywords, word)
  );
  const distinct = HashSet.size(HashSet.fromIterable(matches));

  return (
    (matches.length + distinct * KEYWORD_BONUS_POINTS) /
    Math.max(paragraph.length / PARAGRAPH_LENGTH_DIVISOR, 1)
  );
}

/**
 * Finds where the last whole sentence of a cut text ends, by the platform's own
 * sentence rules, so it holds for the full stop of every script. The last part
 * is the sentence the cut may have broken, so it never counts. Returns 0 when
 * the text holds no whole sentence.
 */
function findSentenceEnd(text: string) {
  const segmenter = new Intl.Segmenter(undefined, { granularity: "sentence" });
  const ends = Arr.flatMap(
    Arr.dropRight(Arr.fromIterable(segmenter.segment(text)), 1),
    ({ index, segment }) => {
      const sentence = segment.trimEnd();

      return sentence ? [index + sentence.length] : [];
    }
  );

  return Option.getOrElse(Arr.last(ends), () => 0);
}

/**
 * Truncates source text at a readable boundary when possible.
 */
function truncateAtBoundary(text: string, maxLength: number): string {
  if (text.length <= maxLength) {
    return text;
  }

  const truncated = text.slice(0, maxLength);
  const sentenceEnd = findSentenceEnd(truncated);

  if (sentenceEnd > maxLength * TRUNCATION_THRESHOLDS.sentence) {
    return truncated.slice(0, sentenceEnd);
  }

  const boundaries = [
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
      return (
        truncated.slice(0, lastIndex) + (boundary.type === "word" ? "..." : "")
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

  const segmenter = new Intl.Segmenter(undefined, { granularity: "word" });
  const keywords = HashSet.fromIterable(readWords(segmenter, query));
  if (HashSet.size(keywords) === 0) {
    return truncateAtBoundary(content, maxLength);
  }

  const paragraphs = pipe(
    content.split(PARAGRAPH_SPLIT_REGEX),
    Arr.map((p) => p.trim()),
    Arr.filter(Boolean)
  );

  if (paragraphs.length <= 2) {
    return truncateAtBoundary(content, maxLength);
  }

  const analyzedParagraphs: ContentParagraph[] = Arr.map(
    paragraphs,
    (text, index) => ({
      text,
      score: calculateRelevanceScore(text, keywords, segmenter),
      index,
      length: text.length,
    })
  );

  const intro = analyzedParagraphs[0];
  let selectedParts = preserveStructure ? [intro.text] : [];
  let currentLength = preserveStructure ? intro.length + 2 : 0;
  const targetLength = maxLength * TARGET_LENGTH_BUFFER;
  const candidates = preserveStructure
    ? Arr.dropRight(Arr.drop(analyzedParagraphs, 1), 1)
    : analyzedParagraphs;
  const paragraphLimit = preserveStructure
    ? maxRelevantParagraphs
    : Math.max(minRelevantParagraphs, maxRelevantParagraphs);
  const topParagraphs = pipe(
    Arr.filter(candidates, (paragraph) => paragraph.score > 0),
    Arr.sortWith((paragraph) => paragraph.score, Order.flip(Order.Number)),
    Arr.take(paragraphLimit)
  );
  const selectedParagraphs = preserveStructure
    ? pipe(
        topParagraphs,
        Arr.sortWith((paragraph) => paragraph.index, Order.Number)
      )
    : topParagraphs;
  for (const paragraph of selectedParagraphs) {
    if (currentLength + paragraph.length + 2 < targetLength) {
      selectedParts = Arr.append(selectedParts, paragraph.text);
      currentLength += paragraph.length + 2;
    }
  }

  const conclusion = Arr.last(analyzedParagraphs);
  if (
    preserveStructure &&
    Option.isSome(conclusion) &&
    currentLength + conclusion.value.length + 2 < targetLength
  ) {
    selectedParts = Arr.append(selectedParts, conclusion.value.text);
  }

  if (selectedParts.length === 0) {
    return truncateAtBoundary(content, maxLength);
  }

  const result = Arr.join(selectedParts, "\n\n");
  return truncateAtBoundary(result, maxLength);
}
