import { CREDIT_UNIT_MICRO_USD } from "@repo/backend/confect/credits/constants";
import { languageModel } from "@repo/backend/confect/gateway/model";
import type { Purpose } from "@repo/backend/confect/gateway/purpose";
import { Schema } from "effect";

/**
 * Every vendor a Nakafa call spends money with. Anthropic writes through the
 * Convex AI gateway (Claude Haiku 5.5), TypeSafe decides (Jev 1.13), Google
 * embeds (Gemini Embedding 2), and Firecrawl searches and reads web pages.
 */
export const Vendor = Schema.Literals([
  "anthropic",
  "typesafe",
  "google",
  "firecrawl",
]);
export type Vendor = typeof Vendor.Type;

/** What one call spends on: a language purpose, a decision, an embedding, a web search or a page read. */
export const Work = Schema.Literals([
  "chat",
  "specialist",
  "background",
  "suggestion",
  "presentation",
  "import",
  "decision",
  "embedding",
  "search",
  "scrape",
]);
export type Work = typeof Work.Type;

/** Micro-dollars in one dollar: every amount the ledger stores is a whole number of them. */
const MICRO_USD = 1_000_000;

/** Tokens a token rate is priced per. */
const PER_TOKENS = 1_000_000;

/**
 * The margin on every amount Nakafa estimates instead of reading it from the
 * vendor's bill, in basis points: 25% over the public rate, the AI buffer of
 * the School pricing report of 2 November 2026 ("buffer USD 15%, AI 25%"). A
 * cost the gateway reports is the bill itself and takes no margin.
 */
const BUFFER_BASIS_POINTS = 12_500;

/**
 * The public rates, in micro-dollars per million tokens, and per credit for
 * Firecrawl. Each was read on the vendor's own page on 7 November 2026, and
 * every rate here is the only copy in the code.
 *
 * - Claude Haiku 5.5, https://platform.claude.com/docs/en/about-claude/pricing:
 *   $0.10 input, $0.50 output, $0.01 cache read and $0.125 five-minute cache
 *   write per million tokens for prompts up to 100,000 tokens, and five times
 *   each rate above. The Convex AI gateway charges the provider's rate with no
 *   markup (https://news.convex.dev/introducing-convex-ai-gateway/).
 * - Jev 1.13: $0.042 input and $0 output per million tokens, as the Convex AI
 *   gateway itself reported it: `usage.cost` of 0.0000164 US dollars for a
 *   decision of about 390 input tokens, measured on 12 October 2026 (ADR 0019).
 * - Gemini Embedding 2, https://aistudio.google.com/docs/pricing: $0.20 per
 *   million text input tokens on the paid tier.
 * - Firecrawl, https://www.firecrawl.dev/pricing and
 *   https://docs.firecrawl.dev/billing: 2 credits per 10 search results,
 *   rounded up per 10, and 1 credit per page read. A credit is priced at the
 *   Hobby plan's extra credits, $5 per 1,000, the dearest way Nakafa buys one.
 */
const rates = {
  haiku: {
    input: 100_000,
    output: 500_000,
    cacheRead: 10_000,
    cacheWrite: 125_000,
    /** The prompt length above which every rate is multiplied by `longFactor`. */
    longPrompt: 100_000,
    longFactor: 5,
  },
  jev: { input: 42_000, output: 0 },
  embedding: { input: 200_000 },
  firecrawl: {
    credit: 5000,
    searchCredits: 2,
    resultsPerSearchUnit: 10,
    scrapeCredits: 1,
  },
} as const;

/** The vendor behind each kind of work. */
const VENDORS = {
  chat: "anthropic",
  specialist: "anthropic",
  background: "anthropic",
  suggestion: "anthropic",
  presentation: "anthropic",
  import: "anthropic",
  decision: "typesafe",
  embedding: "google",
  search: "firecrawl",
  scrape: "firecrawl",
} satisfies Record<Work, Vendor>;

/** The vendor one kind of work spends with. */
export function vendorOf(work: Work): Vendor {
  return VENDORS[work];
}

/** An amount with the estimate margin, rounded up to a whole micro-dollar. */
export function buffered(microUsd: number) {
  return Math.ceil((microUsd * BUFFER_BASIS_POINTS) / 10_000);
}

/** The micro-dollars `tokens` cost at `rate` micro-dollars per million tokens. */
function tokenCost(tokens: number, rate: number) {
  return (tokens * rate) / PER_TOKENS;
}

/** The tokens of one language model call, as the AI SDK reports them. */
const LanguageTokens = Schema.Struct({
  /** Every prompt token, the cached ones included. */
  input: Schema.Int,
  output: Schema.Int,
  cacheRead: Schema.Int,
  cacheWrite: Schema.Int,
});

/**
 * What a Claude Haiku 5.5 call costs at the public rates, with the estimate
 * margin: uncached prompt tokens at the input rate, cache reads and writes at
 * theirs, and the output. A prompt over `longPrompt` tokens pays every rate
 * `longFactor` times.
 */
export function languageCost(tokens: typeof LanguageTokens.Type) {
  const factor =
    tokens.input > rates.haiku.longPrompt ? rates.haiku.longFactor : 1;
  const uncached = Math.max(
    0,
    tokens.input - tokens.cacheRead - tokens.cacheWrite
  );
  const cost =
    tokenCost(uncached, rates.haiku.input) +
    tokenCost(tokens.cacheRead, rates.haiku.cacheRead) +
    tokenCost(tokens.cacheWrite, rates.haiku.cacheWrite) +
    tokenCost(tokens.output, rates.haiku.output);
  return buffered(cost * factor);
}

/**
 * The most one language call of `purpose` can cost: a full prompt below the
 * long-prompt step, every token of it written to the cache (the dearest input
 * rate), and the purpose's whole output cap. The escrow holds this before the
 * call, and the call settles to what it measured.
 */
export function languageCeiling(purpose: Purpose) {
  return languageCost({
    input: languageModel.contextLimit,
    output: languageModel.output[purpose],
    cacheRead: 0,
    cacheWrite: languageModel.contextLimit,
  });
}

/**
 * What a model reported a call cost, in dollars, as micro-dollars rounded up.
 * The dollars are rounded to nano-dollars first, so a float such as
 * 0.00125 x 1,000,000 = 1,250.0000000000002 does not round up a whole unit.
 */
export function reportedCost(dollars: number) {
  return Math.ceil(Math.round(dollars * MICRO_USD * 1000) / 1000);
}

/** What one Jev decision of `input` tokens costs, with the estimate margin. */
export function decisionCost(input: number) {
  return buffered(tokenCost(input, rates.jev.input));
}

/** What embedding `input` tokens costs, with the estimate margin. */
export function embeddingCost(input: number) {
  return buffered(tokenCost(input, rates.embedding.input));
}

/**
 * The tokens a text can hold at most: its UTF-8 bytes, because no tokenizer
 * Nakafa calls makes a token of less than one byte. An escrow of an embedding
 * or a decision counts its text with it before the call.
 */
export function tokenBound(text: string) {
  return new TextEncoder().encode(text).length;
}

/** What one Firecrawl search of up to `results` results costs, with the estimate margin. */
export function searchCost(results: number) {
  const units = Math.ceil(results / rates.firecrawl.resultsPerSearchUnit);
  return buffered(
    units * rates.firecrawl.searchCredits * rates.firecrawl.credit
  );
}

/** What one Firecrawl page read costs, with the estimate margin. */
export function scrapeCost() {
  return buffered(rates.firecrawl.scrapeCredits * rates.firecrawl.credit);
}

/** The credits `microUsd` of direct AI cost is worth: one credit per US$0.002, rounded up. */
export function creditsOf(microUsd: number) {
  return Math.ceil(microUsd / CREDIT_UNIT_MICRO_USD);
}
