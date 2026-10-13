import { Array as Arr } from "effect";
import { countTokens, decode, encode } from "gpt-tokenizer";

/**
 * Model-facing token budgets for one Nina turn. Gemini accepts far more, so
 * these bound cost and latency; every limit truncates with a visible note
 * instead of failing the turn. `NINA_CALL_LIMIT` adds up the ones a chat call
 * holds at once. `captureKnown`, `captureMessage` and `foldMessage` bound the
 * input of separate background calls, the memory capture and the summary
 * refresh, so they are not part of it.
 */
export const NINA_BUDGET = {
  /**
   * The account facts Nina reads about the learner. A try-out stores as many
   * sections as its set has, so the facts are bounded here and never crowd the
   * rest of the learner section out.
   */
  account: 500,
  /**
   * The whole list of known memories one capture call reads. It holds at most
   * `MEMORY_KNOWN_LIMIT` memories, and each shows only its first characters, so
   * this is a second bound. The list is best match first, and one that does not
   * fit loses its last memories, which the model cannot name.
   */
  captureKnown: 4000,
  /** The learner text one capture call reads. */
  captureMessage: 1000,
  /** One capability output returned to the main Agent. */
  evidence: 6000,
  /** Evidence gathered by all tool calls in the current turn. */
  turnEvidence: 16_000,
  /** The text one message contributes to the transcript of a summary refresh. */
  foldMessage: 1500,
  /**
   * Complete turns kept word for word after the conversation summary. When
   * they cost more than this, the summary folds the oldest of them down to
   * half of it.
   */
  history: 32_000,
  /**
   * Nina's static instructions, her four tool definitions and the runtime
   * facts of a turn: what every call carries before any conversation. Nothing
   * cuts to this number. The budget test measures the real ones against it
   * from a real turn (5,143 tokens with the memory capability, measured on 12
   * October 2026), and it is rounded up to the next 1,000 tokens.
   */
  instructions: 6000,
  /** The memories the memory capability returns to Nina in one call. */
  lookup: 1500,
  /** The signed current page placed in the stable prompt context. */
  page: 6000,
  /** The learner's portrait in the stable system prompt. */
  portrait: 300,
  /** The memories a turn recalls, in front of the learner's message. */
  recall: 700,
  /** The rolling summary of the turns folded out of the history. */
  summary: 2000,
} as const;

/**
 * The most tokens one Nina model call is built to carry, 63,500: the parts of
 * `NINA_BUDGET` that a call holds at once, which are the instructions, the
 * page, what Nina reads about the learner (the account facts, the portrait and
 * the recalled memories, 1,500 together), the summary, the history and the
 * evidence of the current turn. One tool result (`evidence`, or `lookup` for
 * the memory capability) lies inside the turn's evidence, so it is not added
 * again.
 *
 * The model accepts 1,048,576 input tokens
 * (https://ai.google.dev/gemini-api/docs/models/gemini-3.8-flash, the model in
 * `gateway/model.ts`, as that page read on 12 October 2026). Nina stays far
 * below that on purpose. Every call bills every token it carries again, a
 * larger call takes longer to read before the first word, and the provider
 * keeps a prefix for only about five minutes (`gateway/cache.ts`), so the
 * first call after a pause pays full price for all of it.
 *
 * This is what Nina's own builders hold, and three things lie outside it. The
 * learner's message and files are checked when a turn is admitted, and a
 * question focus has no budget of its own. The newest earlier turn is also kept
 * whatever it costs: only its tool results are shortened, never the words of
 * the learner or of Nina, so one very long message or answer in that turn can
 * take the history above its part.
 */
export const NINA_CALL_LIMIT =
  NINA_BUDGET.instructions +
  NINA_BUDGET.page +
  NINA_BUDGET.account +
  NINA_BUDGET.portrait +
  NINA_BUDGET.recall +
  NINA_BUDGET.summary +
  NINA_BUDGET.history +
  NINA_BUDGET.turnEvidence;

/** Tokens reserved for the truncation note appended to bounded text. */
const NOTE_TOKENS = 80;

/**
 * Counts model tokens with the shared tokenizer used for every budget. The
 * tokenizer is OpenAI's, and the model is Gemini, so a budget is a count that is
 * close to what the provider bills and not the same. Measured on 12 October
 * 2026 through the Convex AI gateway with `google/gemini-3.8-flash`, on five
 * stored sections of 2,751 to 3,684 characters: the provider counted 5.6% more
 * for German prose, 5.1% more for English, 0.4% fewer for Indonesian, 13.6%
 * more for an Indonesian lesson full of formulas, and 8.2% fewer for Arabic
 * verses with their Indonesian translation. A message adds nothing around its
 * content: 1, 21, 41 and 81 messages of one token each cost 1, 21, 41 and 81
 * tokens. A tool call with its result costs what `messageTokens` counts for
 * them: 14 tokens a pair for a short call, by both counts, at 10, 20 and 40
 * pairs.
 */
export function countTextTokens(text: string) {
  return countTokens(text);
}

/**
 * What Gemini 3 bills at its default media resolution, which Nina leaves
 * unset: 1,120 tokens for an image of any size and 560 for a page of a
 * document. Earlier Gemini models billed an image by 768 pixel tiles instead.
 *
 * @see https://ai.google.dev/gemini-api/docs/media-resolution
 */
const IMAGE_TOKENS = 1120;
const DOCUMENT_PAGE_TOKENS = 560;

/**
 * Tokens the model bills for one attachment, from its media type alone: this
 * is the one rule for what a file costs, so a file's bytes never reach the
 * tokenizer. A stored message keeps no size, page count, or dimensions of its
 * files, so a document counts one page. History only ever counts images: an
 * earlier document is replaced by a note before anything is counted, and the
 * learner's own message is not evidence.
 */
export function countFileTokens(mediaType: string) {
  return mediaType.startsWith("image/") ? IMAGE_TOKENS : DOCUMENT_PAGE_TOKENS;
}

/**
 * Keeps text within `limit` tokens. Truncated text ends on a paragraph or line
 * boundary when one is close, followed by a note that tells the model what
 * was omitted and how to read further.
 */
export function boundText(text: string, limit: number, continuation: string) {
  const tokens = encode(text);
  if (tokens.length <= limit) {
    return text;
  }
  const kept = decode(Arr.take(tokens, Math.max(0, limit - NOTE_TOKENS)));
  // A paragraph break ends with a line break, so this also finds paragraphs.
  const boundary = kept.lastIndexOf("\n");
  const cut = boundary > kept.length * 0.6 ? kept.slice(0, boundary) : kept;
  return `${cut.trimEnd()}\n\n[Shortened to about ${limit} of ${tokens.length} tokens. ${continuation}]`;
}
