import { languageModel } from "@repo/backend/confect/gateway/model";

/**
 * Nina's parts of a call that hold their budget whatever the turn holds: the
 * instructions with the tool definitions and the runtime facts, the signed
 * page, what Nina reads about the learner, and the rolling summary. The history
 * and the current turn share what is left of the call limit after them. Most of
 * these travel in the system prompt. The recalled memories travel in front of
 * the learner's message, which the current turn counts as it is sent, so they
 * are counted twice: a conservative reserve. Each budget was re-derived on
 * 14 October 2026 from the Gemini tokens it held before, by the ratio of Claude
 * to Gemini tokens for its kind of text, rounded up to the next 500 tokens, and
 * the instructions by their measured count. The ratios over 120 texts:
 * Indonesian 1.746, German 1.708, English 1.450, all texts 1.624.
 */
const RESERVED = {
  /** The account facts Nina reads about the learner: 500 before, 873 with the Indonesian ratio, now 1,000. */
  account: 1000,
  /**
   * Nina's static instructions, her four tool definitions and the runtime facts,
   * as the estimator counts them in the budget test: 12,444 tokens. The budget
   * was 6,000 before. The English ratio (8,700) does not apply, because the tool
   * definitions and the runtime facts are JSON, which the estimator prices at one
   * token a punctuation mark, so the budget holds the measured count, rounded up
   * to the next 500.
   */
  instructions: 12_500,
  /** The signed current page in the system prompt: 6,000 before, 10,476 with the Indonesian ratio, now 10,500. */
  page: 10_500,
  /** The learner's portrait in the system prompt: 300 before, 524 with the Indonesian ratio, now 1,000. */
  portrait: 1000,
  /** The memories a turn recalls, in front of the learner's message: 700 before, 1,222 with the Indonesian ratio, now 1,500. */
  recall: 1500,
  /** The rolling summary of the turns folded out of the history: 2,000 before, 3,492 with the Indonesian ratio, now 3,500. */
  summary: 3500,
};

/** Evidence gathered by all tool calls in one turn: 16,000 before, 27,936 with the Indonesian ratio, now 28,000. */
const TURN_EVIDENCE = 28_000;

/**
 * What a call holds of its reserved parts at their budgets: 30,000 tokens. The
 * history and the current turn share what is left of the call limit after them.
 */
export const NINA_RESERVED =
  RESERVED.account +
  RESERVED.instructions +
  RESERVED.page +
  RESERVED.portrait +
  RESERVED.recall +
  RESERVED.summary;

/**
 * The most tokens one Nina model call is built to carry: the context limit less
 * a margin for the estimator's error. The margin is the 95th percentile of the
 * estimator's undercount on 120 texts, 9.39% of the limit (`tokens.undercount`
 * in the language model profile), so a call whose true count is at most the
 * context limit has an estimate of at most this number, for 95 calls in 100.
 * With the profile's values this is 100,000 less 9,390, which is 90,610.
 */
export const NINA_CALL_LIMIT =
  languageModel.contextLimit -
  Math.ceil(
    (languageModel.contextLimit * languageModel.tokens.undercount) / 10_000
  );

/**
 * Model-facing token budgets for one Nina turn. Every limit truncates with a
 * visible note instead of failing the turn. `captureMessage` and `foldMessage`
 * bound the input of separate background calls, the memory capture and the
 * summary refresh, so they are not part of a chat call. The known memories of
 * the capture call have no budget of their own: the query holds them to
 * `MEMORY_KNOWN_LIMIT` memories of `KNOWN_LENGTH` characters each, at most about
 * 3,800 estimator tokens, so a budget there could never cut them. Its old budget
 * of 4,000 Gemini tokens was only reached by rare characters, which the old
 * tokenizer priced at two or three tokens each.
 */
export const NINA_BUDGET = {
  ...RESERVED,
  /** The learner text one capture call reads: 1,000 before, 1,746 with the Indonesian ratio, now 2,000. */
  captureMessage: 2000,
  /** One capability output returned to the main Agent: 6,000 before, 10,476 with the Indonesian ratio, now 10,500. */
  evidence: 10_500,
  /** Evidence gathered by all tool calls in the current turn. */
  turnEvidence: TURN_EVIDENCE,
  /** The text one message contributes to the transcript of a summary refresh: 1,500 before, 2,619 with the Indonesian ratio, now 3,000. */
  foldMessage: 3000,
  /**
   * Complete turns kept word for word after the conversation summary: what is
   * left of the call limit after the reserved parts and the turn's evidence, so
   * 32,610 tokens. When the turns cost more than this, the summary folds the
   * oldest of them down to half of it. A call whose current turn costs more than
   * the evidence budget gets less history (`assembleContext`), never more.
   */
  history: NINA_CALL_LIMIT - NINA_RESERVED - TURN_EVIDENCE,
  /** The memories the memory capability returns to Nina in one call: 1,500 before, 2,619 with the Indonesian ratio, now 3,000. */
  lookup: 3000,
};

/**
 * One piece of text the estimator prices: a run of Latin letters, a single Han
 * character, another letter, a digit, a run of spaces that is not a newline, a
 * newline, an underscore, or any other single character such as punctuation,
 * a mark or an emoji. The groups are read by position, so an unmatched group is
 * `undefined`.
 */
const PIECE =
  /([A-Za-zÀ-ÖØ-öø-ɏḀ-ỿ]+)|([㐀-䶿一-鿿豈-﫿\u{20000}-\u{2fa1f}])|(\p{L})|(\p{Nd})|([^\S\n]+)|(\n)|(_)|[\s\S]/gu;

/** The tokens one matched piece costs, by the rule of the group that matched it. */
function pieceTokens(match: RegExpExecArray) {
  const costs = languageModel.tokens;
  const [, latin, han, letter, digit, space, newline, underscore] = match;
  if (latin !== undefined) {
    return Math.ceil(latin.length / costs.latinLettersPerToken);
  }
  if (han !== undefined) {
    return costs.han;
  }
  if (letter !== undefined) {
    return costs.otherLetter;
  }
  if (digit !== undefined) {
    return costs.digit;
  }
  if (space !== undefined) {
    return space.length === 1 ? costs.space : costs.spaceRun;
  }
  if (newline !== undefined) {
    return costs.newline;
  }
  if (underscore !== undefined) {
    return costs.underscore;
  }
  return costs.other;
}

/**
 * Counts model tokens for a text, by the rules of the language model profile
 * (`tokens`): one estimator for every budget, whose costs change with the model
 * and nothing else. A message adds the profile's `message` overhead on top, in
 * the history. Fitted on 120 texts, the estimate was 13.1% off a text on average
 * and 4% above the provider over all of them.
 */
export function countTextTokens(text: string) {
  let total = 0;
  for (const match of text.matchAll(PIECE)) {
    total += pieceTokens(match);
  }
  return Math.ceil(total);
}

/** The longest run of whole pieces from the start of `text` that costs at most `room` tokens. */
function prefixWithin(text: string, room: number) {
  let total = 0;
  let end = 0;
  for (const match of text.matchAll(PIECE)) {
    total += pieceTokens(match);
    if (total > room) {
      break;
    }
    end = match.index + match[0].length;
  }
  return text.slice(0, end);
}

/**
 * Keeps text within `limit` tokens. Truncated text ends on a paragraph or line
 * boundary when one is close, followed by a note that tells the model what was
 * omitted and how to read further. The note is priced first, so the kept text
 * and the note together stay within the limit.
 */
export function boundText(text: string, limit: number, continuation: string) {
  const total = countTextTokens(text);
  if (total <= limit) {
    return text;
  }
  const note = `\n\n[Shortened to about ${limit} of ${total} tokens. ${continuation}]`;
  const kept = prefixWithin(text, limit - countTextTokens(note));
  // A paragraph break ends with a line break, so this also finds paragraphs.
  const boundary = kept.lastIndexOf("\n");
  const cut = boundary > kept.length * 0.6 ? kept.slice(0, boundary) : kept;
  return `${cut.trimEnd()}${note}`;
}

/**
 * Tokens the provider bills for one attachment, from its media type alone: this
 * is the one rule for what a file costs, so a file's bytes never reach the
 * estimator. A stored message keeps no size, page count, or dimensions of its
 * files, so a document counts one page. History only ever counts images: an
 * earlier document is replaced by a note before anything is counted, and the
 * learner's own message is not evidence.
 */
export function countFileTokens(mediaType: string) {
  return mediaType.startsWith("image/")
    ? languageModel.files.image
    : languageModel.files.documentPage;
}
