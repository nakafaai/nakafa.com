import { Schema } from "effect";

/** How much a model reasons: deeply for an answer the learner reads, briefly for supporting work. */
export const Effort = Schema.Literals(["fast", "interactive"]);
export type Effort = typeof Effort.Type;

/** The reasoning efforts the Convex AI gateway accepts for a language model call. */
const ReasoningEffort = Schema.Literals([
  "none",
  "minimal",
  "low",
  "medium",
  "high",
  "xhigh",
  "max",
]);

/**
 * The language model profile: the one record of the model Nina calls and of
 * every fact the code takes from it. Switching the model changes this record
 * alone, and nothing outside `confect/gateway` names the model or a fact of it.
 * The facts were measured on 14 October 2026 through the Convex AI gateway on
 * the dev deployment (ADR 0019, ADR 0020, ADR 0001).
 */
const LanguageModel = Schema.Struct({
  /** The model's id on the gateway, as each usage row stores it. */
  id: Schema.String,
  /**
   * The reasoning effort the gateway is sent for each `Effort`. Chat uses
   * `high`, not `xhigh`: at `xhigh` a long answer reasons without bound. A
   * lesson request wrote 30,038 tokens at `high` (7,070 of them reasoning) in
   * 108 s and stopped by itself. At `xhigh` the same request reasoned 53,370
   * tokens and still reached a 64,000 cap in 236 s, so the learner would get a
   * cut answer. For one arithmetic question the reasoning was 51 tokens at
   * `low`, 122 at `xhigh` and 187 at `max`. Changing chat back is one line.
   */
  reasoning: Schema.Struct({
    fast: ReasoningEffort,
    interactive: ReasoningEffort,
  }),
  /**
   * The most tokens one call may carry before the provider charges five times
   * the input price. A call of 94,423 prompt tokens billed $0.10 per million
   * input tokens, and one of 104,573 billed $0.50. Public pricing names 100,000
   * as the step, so the limit sits just below it.
   */
  contextLimit: Schema.Int,
  /**
   * The most one call of each purpose may write, its reasoning included. Chat:
   * the longest measured answer at `high` wrote 30,038 tokens and stopped by
   * itself, and 48,000 is that rounded up with a margin of about 1.6. The other
   * purposes reason at `low`, where a 16-turn summary wrote 339 tokens (94 of
   * them reasoning) in 3 s. A specialist's cap is `NINA_BUDGET.evidence`
   * rounded up to a unit of 1,024, a background cap a little over twice the
   * summary budget, and a suggestion or title is far below 512 tokens.
   */
  output: Schema.Struct({
    chat: Schema.Int,
    specialist: Schema.Int,
    background: Schema.Int,
    suggestion: Schema.Int,
    presentation: Schema.Int,
  }),
  /**
   * What one piece of text costs in the estimator of `confect/nina/budget.ts`,
   * in model tokens. A run of Latin letters costs one token per 2.25 letters,
   * rounded up. Any other letter costs 1 and a Han character 1.25. A digit or
   * any other character costs 1, a newline 0, a single space 0, a run of two or
   * more spaces 0.5, and an underscore 0. One user message adds `message`
   * tokens around its content. Fitted on 120 texts (Latin, Han, Arabic, German,
   * Indonesian, LaTeX, code, URLs and emoji) against the provider's count: the
   * estimate is 13.1% off a text on average and 4% above the provider over all
   * of them. `undercount` is the 95th percentile of the estimate's undercount
   * over the same texts, in basis points: 9.387% by linear interpolation
   * between the 114th and 115th of the 120 sorted values (9.377% by nearest
   * rank), rounded up to 939.
   */
  tokens: Schema.Struct({
    latinLettersPerToken: Schema.Finite,
    otherLetter: Schema.Finite,
    han: Schema.Finite,
    digit: Schema.Finite,
    other: Schema.Finite,
    newline: Schema.Finite,
    space: Schema.Finite,
    spaceRun: Schema.Finite,
    underscore: Schema.Finite,
    message: Schema.Int,
    undercount: Schema.Int,
  }),
  /**
   * What the provider bills for one attachment. An image costs about 1,600
   * tokens at any size the resize allows, against 46 for a 96 by 96 PNG (the
   * provider bills pixels over 750, after a resize to 1,568 pixels on the long
   * edge). One document page costs about 3,300: a full US Letter page of 52
   * lines of 10-point text cost 3,298, and a one-page PDF with one line cost
   * 1,146.
   */
  files: Schema.Struct({
    image: Schema.Int,
    documentPage: Schema.Int,
  }),
  /**
   * The prompt cache. The gateway caches nothing without the marker: one call
   * with it wrote 12,802 tokens and the next read the same 12,802 at a tenth of
   * the input price, and without it nothing was cached. Prefixes of 1,058 to
   * 5,282 tokens were all cached, so `minimumPrefix` is the smallest one
   * measured to be cached, at most 1,058.
   */
  cache: Schema.Struct({
    marker: Schema.Struct({
      cache_control: Schema.Struct({ type: Schema.Literals(["ephemeral"]) }),
    }),
    minimumPrefix: Schema.Int,
  }),
});
type LanguageModel = typeof LanguageModel.Type;

/** The language model Nina calls, with every fact of it. */
export const languageModel = {
  id: "anthropic/claude-haiku-5.5",
  reasoning: { fast: "low", interactive: "high" },
  contextLimit: 100_000,
  output: {
    chat: 48_000,
    specialist: 11_264,
    background: 7168,
    suggestion: 512,
    presentation: 512,
  },
  tokens: {
    latinLettersPerToken: 2.25,
    otherLetter: 1,
    han: 1.25,
    digit: 1,
    other: 1,
    newline: 0,
    space: 0,
    spaceRun: 0.5,
    underscore: 0,
    message: 8,
    undercount: 939,
  },
  files: { image: 1600, documentPage: 3300 },
  cache: {
    marker: { cache_control: { type: "ephemeral" } },
    minimumPrefix: 1058,
  },
} satisfies LanguageModel;

/**
 * The decision model behind every judgment of a learner's words, as the Convex
 * AI gateway names it: Jev from TypeSafe, which answers typed questions about a
 * text with a probability instead of writing text.
 */
export const decisionModelId = "typesafe/jev-1.13";

/**
 * The provider id the AI SDK gives the chat models of `convexGateway`. Every
 * usage row of a call that went through a gateway handle stores it.
 */
export const providerId = "convexGateway.chat";

/**
 * The embedding models that the model test compares, as the Convex AI gateway
 * names them: the current multilingual models of Google, OpenAI, and Qwen out
 * of the many that the gateway lists. A model joins the shortlist with one
 * line, and the test then measures it like the others.
 */
export const embeddingModels = [
  "google/gemini-embedding-001",
  "google/gemini-embedding-2",
  "openai/text-embedding-3-large",
  "openai/text-embedding-3-small",
  "qwen/qwen3-embedding-4b",
  "qwen/qwen3-embedding-8b",
] as const;
export const EmbeddingModelId = Schema.Literals(embeddingModels);
export type EmbeddingModelId = typeof EmbeddingModelId.Type;

/**
 * The embedding model behind knowledge search: Google's newest embedding model
 * on the gateway. Decided on 12 October 2026 from three things. Google's own
 * benchmark puts it first (MTEB Multilingual 69.9, against 68.4 for
 * `gemini-embedding-001`). It takes 8,192 input tokens, against 2,048. And the
 * older model shuts down on 14 May 2028. The model test in `scripts/knowledge`
 * (150 questions in three languages) found the right section in the top five
 * for 142 questions, against 146 for the older model, a difference inside the
 * noise of 50 questions a language, at 433 ms a question against 257 ms.
 * Changing this constant changes every stored vector, so the next section build
 * re-embeds all of them.
 */
export const embeddingModelId: EmbeddingModelId = "google/gemini-embedding-2";

/**
 * The length of every stored and every query vector, requested from the model
 * with `dimensions`. The vector index of `contentSections` has the same length,
 * so one length for all candidate models keeps a model change from changing the
 * index. Convex counts a vector of 768 numbers as 6,914 bytes.
 */
export const embeddingDimensions = 768;

/** How long one embedding call may run before it counts as a timeout. */
export const embeddingTimeoutMs = 30_000;
