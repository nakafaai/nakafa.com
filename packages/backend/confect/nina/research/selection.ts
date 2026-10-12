import {
  Array as Arr,
  HashMap,
  HashSet,
  Iterable as Iter,
  Option,
  Order,
  pipe,
  Schema,
} from "effect";

const DEFAULT_MAX_LENGTH = 2000;
const TARGET_LENGTH_BUFFER = 0.9;
/**
 * The smoothing of the inverse document frequency in the Okapi BM25 ranking. It
 * keeps the weight of a word that no paragraph holds, or that every paragraph
 * holds, finite and above zero.
 */
const WEIGHT_SMOOTHING = 0.5;

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
 * Weighs a query word by how few paragraphs of the page hold it, with the
 * inverse document frequency of the Okapi BM25 ranking, where the paragraphs
 * play the part of the documents. A word that most paragraphs hold, such as a
 * particle or a preposition, tells them little apart and weighs little. A word
 * that few hold points at them and weighs much. The page shows which words are
 * common, so no list of words to skip is needed and every language is treated
 * the same.
 */
function weighWord(
  wordsByParagraph: readonly HashSet.HashSet<string>[],
  word: string
) {
  const holding = Arr.countBy(wordsByParagraph, HashSet.has(word));

  return Math.log(
    1 +
      (wordsByParagraph.length - holding + WEIGHT_SMOOTHING) /
        (holding + WEIGHT_SMOOTHING)
  );
}

/**
 * Scores one paragraph by the query words it holds. Each different query word
 * counts once, however often the paragraph repeats it, and counts for as much
 * as the page makes that word weigh. Repeating a word adds nothing, so length
 * alone wins nothing, and a long paragraph that holds more of the query's words
 * is not held back for being long.
 */
function scoreParagraph(
  words: HashSet.HashSet<string>,
  weights: HashMap.HashMap<string, number>
) {
  return HashMap.reduce(weights, 0, (total, weight, word) =>
    HashSet.has(words, word) ? total + weight : total
  );
}

/**
 * Scores each paragraph of a page by the query words it holds. The words of
 * every paragraph are read once: they give the weight of each query word first,
 * and then the score of each paragraph.
 */
function analyzeParagraphs(
  paragraphs: readonly string[],
  queryWords: readonly string[],
  segmenter: Intl.Segmenter
): ContentParagraph[] {
  const wordsByParagraph = Arr.map(paragraphs, (text) =>
    HashSet.fromIterable(readWords(segmenter, text))
  );
  const weights = HashMap.fromIterable(
    Arr.map(
      queryWords,
      (word) => [word, weighWord(wordsByParagraph, word)] as const
    )
  );

  return Arr.map(
    Arr.zip(paragraphs, wordsByParagraph),
    ([text, words], index) => ({
      index,
      length: text.length,
      score: scoreParagraph(words, weights),
      text,
    })
  );
}

/**
 * Finds where the last sentence that fits in `maxLength` characters ends, by
 * the platform's own sentence rules, so it holds for the full stop of every
 * script. The sentences are read from the whole text and the read stops at the
 * first one that does not fit, so a sentence that ends exactly at the limit
 * counts, and a long text is not read to its end. Returns 0 when no whole
 * sentence fits.
 */
function findSentenceEnd(text: string, maxLength: number) {
  const segmenter = new Intl.Segmenter(undefined, { granularity: "sentence" });
  const ends = pipe(
    segmenter.segment(text),
    // A blank part, such as the second line break between two paragraphs, is
    // no sentence and ends nothing.
    Iter.filter(({ segment }) => segment.trim().length > 0),
    Iter.map(({ index, segment }) => index + segment.trimEnd().length),
    Iter.takeWhile((end) => end <= maxLength),
    Arr.fromIterable
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
  const sentenceEnd = findSentenceEnd(text, maxLength);

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
 * Every word of the query is looked for, whatever its line starts with, so the
 * caller gives only the words it wants found.
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
  const queryWords = Arr.dedupe(readWords(segmenter, query));
  if (queryWords.length === 0) {
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

  const analyzedParagraphs = analyzeParagraphs(
    paragraphs,
    queryWords,
    segmenter
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
