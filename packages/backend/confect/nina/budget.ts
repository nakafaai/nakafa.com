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
  /** Older complete turns kept verbatim after the conversation summary. */
  history: 12_000,
  /** The signed current page placed in the stable prompt context. */
  page: 6000,
  /** The rolling summary of turns older than the verbatim history. */
  summary: 1200,
} as const;

/** Tokens reserved for the truncation note appended to bounded text. */
const NOTE_TOKENS = 80;

/** Counts model tokens with the shared tokenizer used for every budget. */
export function countTextTokens(text: string) {
  return countTokens(text);
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
  const kept = decode(tokens.slice(0, Math.max(0, limit - NOTE_TOKENS)));
  // A paragraph break ends with a line break, so this also finds paragraphs.
  const boundary = kept.lastIndexOf("\n");
  const cut = boundary > kept.length * 0.6 ? kept.slice(0, boundary) : kept;
  return `${cut.trimEnd()}\n\n[Shortened to about ${limit} of ${tokens.length} tokens. ${continuation}]`;
}
