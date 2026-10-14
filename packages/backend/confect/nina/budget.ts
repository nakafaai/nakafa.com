import { Array as Arr } from "effect";

/**
 * Model-facing token budgets for one Nina turn. Gemini accepts far more, so
 * these bound cost and latency; every limit truncates with a visible note
 * instead of failing the turn. `NINA_CALL_LIMIT` adds up the ones a chat call
 * holds at once. `captureMessage` and `foldMessage` bound the input of separate
 * background calls, the memory capture and the summary refresh, so they are not
 * part of it.
 */
export const NINA_BUDGET = {
  /**
   * The account facts Nina reads about the learner. A try-out stores as many
   * sections as its set has, so the facts are bounded here and never crowd the
   * rest of the learner section out.
   */
  account: 500,
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
   * cuts to this number. The budget test measures a real turn by
   * `countTextTokens`: the instructions with a question focus for the role that
   * makes them longest, the tool definitions of the call, and its newest message
   * with the runtime facts. With the memory capability on, that measure was 6,094
   * tokens on 14 October 2026: 3,894 instructions, 1,933 tool definitions and 267
   * runtime facts. This number is the measure rounded up to the next 1,000. The
   * tokenizer that `countTextTokens` replaced measured 5,143 on 12 October 2026.
   */
  instructions: 7000,
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
 * The most tokens one Nina model call is built to carry, 64,500: the parts of
 * `NINA_BUDGET` that a call holds at once, which are the instructions, the
 * page, what Nina reads about the learner (the account facts, the portrait and
 * the recalled memories, 1,500 together), the summary, the history and the
 * evidence of the current turn. One tool result (`evidence`, or `lookup` for
 * the memory capability) lies inside the turn's evidence, so it is not added
 * again. Its instructions part is the measure of `NINA_BUDGET.instructions`,
 * rounded up to the next 1,000.
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
 * The four separators from U+001C to U+001F, which the estimator's Python counts
 * as spaces. They are built from their code points, not written as escapes.
 */
const SEPARATORS = String.fromCodePoint(0x1c, 0x1d, 0x1e, 0x1f);

/** The estimator's spaces: White_Space and the four separators. */
const SPACES = `\\p{White_Space}${SEPARATORS}`;

/**
 * The pieces that `countTextTokens` counts, in order: a run of letters (a
 * letter, or a number that is not a decimal digit), one decimal digit, one
 * newline, a run of spaces other than newlines, or one other character. An
 * underscore is in no piece, so it costs nothing. The classes are those of the
 * estimator the budgets were fitted with: its word characters are letters,
 * numbers and the underscore, and its spaces are `SPACES`.
 */
const PIECE = new RegExp(
  `[\\p{L}\\p{Nl}\\p{No}]+|\\p{Nd}|\\n|(?:(?!\\n)[${SPACES}])+|[^\\p{L}\\p{Nl}\\p{No}\\p{Nd}_${SPACES}]`,
  "gu"
);

/** A piece that starts with a letter, as the estimator's `isalpha` reads it. */
const LETTER_START = /^\p{L}/u;

/** A piece that starts with a space, which is never a newline. */
const SPACE_START = new RegExp(`^[${SPACES}]`, "u");

/** One Chinese character, from U+3000 to U+9FFF. */
const CHINESE_CHARACTER = /^[\u{3000}-\u{9fff}]$/u;

/**
 * Counts the tokens of a text, as the provider bills them. The count is an
 * estimate fitted on 13 October 2026 against the provider's own count of 120
 * texts: google/gemini-3.8-flash through the Convex AI gateway, where one user
 * message adds nothing around its content. The texts were six stored sections
 * in each of Indonesian, English and German, of articles, AI, mathematics,
 * physics, chemistry and Quran passages, and chat messages, Python, TypeScript,
 * LaTeX, emoji, Chinese, URLs and numbers.
 *
 * Over all 120 texts together the estimate is 0.4% above the provider's count,
 * and the mean error of one text is 9.1%. For prose, mathematics, science and
 * Quran passages in each language the error runs from 16.2% below to 23.1%
 * above. Emoji are 2.6% above, Chinese 14.2% above, URLs 1.6% above and numbers
 * 13.3% below. Python is 6.1% below and TypeScript 9.2% above.
 *
 * The count uses no tokenizer, so it needs no encoder. The tokenizer that the
 * budgets used before held 3,315 KiB of code and 16 MiB of heap, and the answer
 * run must fit the default Convex runtime. A budget bounds cost and latency far
 * below the model's input limit, so this precision is enough.
 */
export function countTextTokens(text: string) {
  let total = 0;
  for (const match of text.matchAll(PIECE)) {
    total += pieceTokens(match[0]);
  }
  return Math.ceil(total);
}

/**
 * The tokens of one piece, as the estimator counts them: a newline costs 0, a
 * single space 0, two or more spaces 1, a run of letters by `letterTokens`, and
 * any other piece 1.
 */
function pieceTokens(piece: string) {
  if (piece === "\n") {
    return 0;
  }
  if (SPACE_START.test(piece)) {
    return piece.length === 1 ? 0 : 1;
  }
  if (LETTER_START.test(piece)) {
    return letterTokens(piece);
  }
  return 1;
}

/**
 * A run of letters costs 0.75 for each Chinese character, and one token for
 * each eight of its other characters, rounded up.
 */
function letterTokens(letters: string) {
  const characters = Arr.fromIterable(letters);
  const chinese = Arr.filter(characters, (character) =>
    CHINESE_CHARACTER.test(character)
  ).length;
  return chinese * 0.75 + Math.ceil((characters.length - chinese) / 8);
}

/**
 * The index where the last piece of `text` ends whose running cost stays
 * within `budget`. Costs never fall, so the first piece that does not fit ends
 * the count.
 */
function fittingEnd(text: string, budget: number) {
  let used = 0;
  let end = 0;
  for (const match of text.matchAll(PIECE)) {
    used += pieceTokens(match[0]);
    if (used > budget) {
      break;
    }
    end = match.index + match[0].length;
  }
  return end;
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
 * estimator. A stored message keeps no size, page count, or dimensions of its
 * files, so a document counts one page. History only ever counts images: an
 * earlier document is replaced by a note before anything is counted, and the
 * learner's own message is not evidence.
 */
export function countFileTokens(mediaType: string) {
  return mediaType.startsWith("image/") ? IMAGE_TOKENS : DOCUMENT_PAGE_TOKENS;
}

/**
 * Keeps text within `limit` tokens. Truncated text ends after the last piece
 * that fits, on a paragraph or line boundary when one is close, followed by a
 * note that tells the model what was omitted and how to read further.
 */
export function boundText(text: string, limit: number, continuation: string) {
  const total = countTextTokens(text);
  if (total <= limit) {
    return text;
  }
  const kept = text.slice(0, fittingEnd(text, limit - NOTE_TOKENS));
  // A paragraph break ends with a line break, so this also finds paragraphs.
  const boundary = kept.lastIndexOf("\n");
  const cut = boundary > kept.length * 0.6 ? kept.slice(0, boundary) : kept;
  return `${cut.trimEnd()}\n\n[Shortened to about ${limit} of ${total} tokens. ${continuation}]`;
}
