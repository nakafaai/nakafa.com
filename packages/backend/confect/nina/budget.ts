import { languageModel } from "@repo/backend/confect/gateway/model";
import { encodeJsonText } from "@repo/utilities/json";
import type { ModelMessage } from "ai";
import { Array as Arr } from "effect";

/**
 * Nina's parts of a call that hold their budget whatever the turn holds: the
 * instructions with the tool definitions and the runtime facts, the signed
 * page, what Nina reads about the learner, and the rolling summary. The
 * learner's message with its files and the turn's evidence share what the call
 * limit leaves after them, and the history takes what is left. Most of these
 * travel in the system prompt. The recalled memories travel in front of the
 * learner's message, which the turn counts as it is sent, so they are counted
 * twice: a conservative reserve. Each budget is counted by the estimator below
 * and rounded up to the next 500 tokens.
 */
const RESERVED = {
  /** The account facts Nina reads about the learner. */
  account: 1000,
  /**
   * Nina's static instructions, her tool definitions and the runtime facts, as
   * the estimator counts them in the budget test. The tool definitions and the
   * runtime facts are JSON, which the estimator prices at one token a
   * punctuation mark, so the budget holds the measured count, rounded up.
   */
  instructions: 13_500,
  /** The signed current page in the system prompt. */
  page: 10_500,
  /** The learner's portrait in the system prompt. */
  portrait: 1000,
  /** The memories a turn recalls, in front of the learner's message. */
  recall: 1500,
  /** The rolling summary of the turns folded out of the history. */
  summary: 3500,
};

/** Evidence gathered by all tool calls in one turn. */
const TURN_EVIDENCE = 28_000;

/**
 * What a call holds of its reserved parts at their budgets. The learner's
 * message and the history share what is left of the call limit after them.
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
 * estimator's undercount on 120 texts, `tokens.undercount` of the language model
 * profile, as a share of the limit. For 95 texts in 100 the estimate falls short
 * of the true count by at most that share of the true count. So an estimate at
 * most this large has a true count of at most the context limit, for 95 calls
 * in 100.
 */
export const NINA_CALL_LIMIT =
  languageModel.contextLimit -
  Math.ceil(
    (languageModel.contextLimit * languageModel.tokens.undercount) / 10_000
  );

/**
 * What a call leaves for one turn after its reserved parts and the turn's
 * evidence. The learner's message with its files may cost at most this much,
 * and the history takes at most this much, so the message and the evidence fit
 * the call limit together.
 */
const TURN_ROOM = NINA_CALL_LIMIT - NINA_RESERVED - TURN_EVIDENCE;

/**
 * Model-facing token budgets for one Nina turn. Every limit truncates with a
 * visible note instead of failing the turn, except the learner's message: the
 * send refuses a message that costs more than `prompt`. `captureMessage` and
 * `foldMessage` bound the input of separate background calls, the memory capture
 * and the summary refresh, so they are not part of a chat call. The known
 * memories of the capture call have no budget of their own: the query holds them
 * to `MEMORY_KNOWN_LIMIT` memories of `KNOWN_LENGTH` characters each, at most
 * about 3,800 estimator tokens, so a budget there could never cut them.
 */
export const NINA_BUDGET = {
  ...RESERVED,
  /** The learner's message with its files: the most one turn may carry. */
  prompt: TURN_ROOM,
  /** The learner text one capture call reads. */
  captureMessage: 2000,
  /** One capability output returned to the main Agent. */
  evidence: 10_500,
  /** Evidence gathered by all tool calls in the current turn. */
  turnEvidence: TURN_EVIDENCE,
  /** The text one message contributes to the transcript of a summary refresh. */
  foldMessage: 3000,
  /**
   * Complete turns kept word for word after the conversation summary: what the
   * call limit leaves after the reserved parts and one turn's evidence. When the
   * turns cost more than this, the summary folds the oldest of them down to half
   * of it. A call whose current turn costs more gets less history
   * (`assembleContext`), never more.
   */
  history: TURN_ROOM,
  /** The memories the memory capability returns to Nina in one call. */
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
  /([A-Za-zÀ-ÖØ-öø-ɏḀ-ỿ]+)|([㐀-䶿一-鿿豈-﫿\u{20000}-\u{2fa1f}])|(\p{L})|(\p{Nd})|([^\S\n]+)|(\n)|(_)|[\s\S]/gu;

/** The tokens one matched piece costs, by the rule of the group that matched it. */
function pieceTokens(
  match: RegExpExecArray,
  costs: typeof languageModel.tokens
) {
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
 * Counts model tokens for a text by the rules of the language model profile, so
 * every budget shares one estimator whose costs change with the model alone.
 * `costs` defaults to the profile's, and a test passes the costs of its own
 * rules. A message adds the profile's `message` overhead on top, in
 * `countMessageTokens`. Fitted on 120 texts, the estimate was 13.1% off a text on
 * average and 4% above the provider over all of them.
 */
export function countTextTokens(text: string, costs = languageModel.tokens) {
  let total = 0;
  for (const match of text.matchAll(PIECE)) {
    total += pieceTokens(match, costs);
  }
  return Math.ceil(total);
}

/**
 * The longest prefix of one piece that costs at most `room` tokens, cut between
 * characters. A run of letters without a break is one piece, so a piece that
 * alone outgrows the room is cut inside it instead of being dropped whole.
 */
function prefixOfPieceWithin(piece: string, room: number) {
  const characters = Arr.fromIterable(piece);
  let low = 0;
  let high = characters.length;
  while (low < high) {
    const middle = Math.ceil((low + high) / 2);
    if (countTextTokens(Arr.join(Arr.take(characters, middle), "")) <= room) {
      low = middle;
    } else {
      high = middle - 1;
    }
  }
  return Arr.join(Arr.take(characters, low), "");
}

/**
 * The longest run of whole pieces from the start of `text` that costs at most
 * `room` tokens. The piece that does not fit is cut inside, so the text keeps as
 * many of its characters as the room holds.
 */
function prefixWithin(text: string, room: number) {
  let total = 0;
  let end = text.length;
  for (const match of text.matchAll(PIECE)) {
    const cost = pieceTokens(match, languageModel.tokens);
    if (total + cost > room) {
      end = match.index + prefixOfPieceWithin(match[0], room - total).length;
      break;
    }
    total += cost;
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
 * Tokens the provider bills for one attachment, from its media type alone, so a
 * file's bytes never reach the estimator. A stored message keeps no size, page
 * count, or dimensions of its files, so an image counts the most one image
 * costs and a document counts one page.
 */
export function countFileTokens(mediaType: string) {
  return mediaType.startsWith("image/")
    ? languageModel.files.image
    : languageModel.files.documentPage;
}

/**
 * Counts the provider tokens of one model message: the overhead the provider adds
 * to every message, and its content. A file counts what the provider bills for
 * it (`countFileTokens`), not its bytes.
 */
export function countMessageTokens(message: ModelMessage) {
  if (typeof message.content === "string") {
    return languageModel.tokens.message + countTextTokens(message.content);
  }
  let total = languageModel.tokens.message;
  for (const part of message.content) {
    if (part.type === "text" || part.type === "reasoning") {
      total += countTextTokens(part.text);
    } else if (part.type === "tool-call") {
      total += countTextTokens(encodeJsonText(part.input));
    } else if (part.type === "tool-result") {
      total += countTextTokens(encodeJsonText(part.output));
    } else if (part.type === "image") {
      total += countFileTokens(part.mediaType ?? "image/*");
    } else if (part.type === "file") {
      total += countFileTokens(part.mediaType);
    } else {
      total += countTextTokens(encodeJsonText(part));
    }
  }
  return total;
}
