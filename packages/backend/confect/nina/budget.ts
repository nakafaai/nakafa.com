import { Array as Arr } from "effect";
import { countTokens, decode, encode } from "gpt-tokenizer";

/**
 * Model-facing token budgets for one Nina turn. Gemini accepts far more, so
 * these bound cost and latency; every limit truncates with a visible note
 * instead of failing the turn.
 */
export const NINA_BUDGET = {
  /** One capability output returned to the main Agent. */
  evidence: 6000,
  /** Evidence gathered by all tool calls in the current turn. */
  turnEvidence: 16_000,
  /**
   * Complete turns kept word for word after the conversation summary. When
   * they cost more than this, the summary folds the oldest of them down to
   * half of it.
   */
  history: 32_000,
  /** Account facts and the memories Nina reads about the learner. */
  learner: 1500,
  /** The signed current page placed in the stable prompt context. */
  page: 6000,
  /** The rolling summary of the turns folded out of the history. */
  summary: 2000,
} as const;

/** Tokens reserved for the truncation note appended to bounded text. */
const NOTE_TOKENS = 80;

/** Counts model tokens with the shared tokenizer used for every budget. */
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
