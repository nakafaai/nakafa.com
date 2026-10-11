import { Array as Arr, Schema } from "effect";
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
  /** Account facts and remembered facts about the learner. */
  learner: 1500,
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

/** What the provider bills for one image tile (768 by 768 pixels) or one PDF page. */
const TILE_TOKENS = 258;
/** An image no wider and no taller than this many pixels is billed as one tile. */
const SMALL_IMAGE_SIDE = 384;
/** Tiles of an image whose size is unknown: the provider's own example, 960 by 540 pixels. */
const UNKNOWN_IMAGE_TILES = 6;
/** Bytes of a PDF page when only the bytes are known: the ratio of the provider's limits, 50 MB or 1,000 pages. */
const PDF_BYTES_PER_PAGE = 50_000;
/** The provider's page limit for one PDF. */
const PDF_MAX_PAGES = 1000;
/** Gemini counts about 4 characters to a token. */
const TEXT_BYTES_PER_TOKEN = 4;

/**
 * What is known about one attachment. Uploads record none of the optional
 * facts yet, so today a caller knows the media type and nothing else.
 */
const FileFacts = Schema.Struct({
  bytes: Schema.optionalKey(Schema.Int),
  height: Schema.optionalKey(Schema.Int),
  mediaType: Schema.String,
  pages: Schema.optionalKey(Schema.Int),
  width: Schema.optionalKey(Schema.Int),
});

/**
 * Tokens of an image by the provider's published estimate: one tile up to 384
 * pixels on both sides, otherwise 258 per tile, where the tile count divides
 * each side by a crop unit of two thirds of the shorter side. The estimate is
 * rough by the provider's own account, and Gemini 3 can lower it with
 * `media_resolution`, which Nina does not set.
 */
function imageTokens({ height, width }: typeof FileFacts.Type) {
  if (width === undefined || height === undefined) {
    return UNKNOWN_IMAGE_TILES * TILE_TOKENS;
  }
  if (width <= SMALL_IMAGE_SIDE && height <= SMALL_IMAGE_SIDE) {
    return TILE_TOKENS;
  }
  const crop = Math.max(1, Math.floor(Math.min(width, height) / 1.5));
  return Math.ceil(width / crop) * Math.ceil(height / crop) * TILE_TOKENS;
}

/** Tokens of a PDF: 258 per page, with the pages taken from its size when only that is known. */
function pdfTokens({ bytes, pages }: typeof FileFacts.Type) {
  if (pages !== undefined) {
    return pages * TILE_TOKENS;
  }
  if (bytes === undefined) {
    return TILE_TOKENS;
  }
  const estimated = Math.ceil(bytes / PDF_BYTES_PER_PAGE);
  return Math.min(PDF_MAX_PAGES, Math.max(1, estimated)) * TILE_TOKENS;
}

/**
 * Tokens the provider bills for one attachment. This is the one rule for what
 * a file costs, so a file's bytes never reach the tokenizer. Any file that is
 * not an image or a PDF is read as text, and a document of unknown size counts
 * one page.
 */
export function countFileTokens(file: typeof FileFacts.Type) {
  if (file.mediaType.startsWith("image/")) {
    return imageTokens(file);
  }
  if (file.mediaType === "application/pdf") {
    return pdfTokens(file);
  }
  return file.bytes === undefined
    ? TILE_TOKENS
    : Math.ceil(file.bytes / TEXT_BYTES_PER_TOKEN);
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
