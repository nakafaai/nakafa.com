import { Schema } from "effect";

/** US dollars: finite and zero or more. */
const Dollars = Schema.Finite.check(Schema.isGreaterThanOrEqualTo(0));

/** A token count: a whole number, zero or more. */
const Tokens = Schema.Int.check(Schema.isGreaterThanOrEqualTo(0));

export const NinaUsage = Schema.Struct({
  agent: Schema.Literals([
    "nina",
    "nakafa",
    "research",
    "math",
    "math-repair",
    "suggestions",
    "title",
    "nina-repair",
    "memory",
  ]),
  model: Schema.NonEmptyString,
  provider: Schema.NonEmptyString,
  input: Tokens,
  output: Tokens,
  /** Input tokens the provider read from its prompt cache. Rows stored before October 2026 did not record them. */
  cached: Schema.optionalKey(Tokens),
  /** Output tokens the model spent reasoning. Rows stored before October 2026 did not record them. */
  reasoning: Schema.optionalKey(Tokens),
  /** The gateway's reported cost; rows stored before pricing, or calls that report none, have no cost. */
  cost: Schema.optionalKey(Dollars),
});

export const NinaUsageTotal = Schema.Struct({
  ...NinaUsage.fields,
  calls: Schema.Int.check(Schema.isGreaterThan(0)),
});

/**
 * The provider tokens of one model call that belongs to no turn's answer, such
 * as a summary refresh or a portrait build. Such work has no turn ledger, so its
 * row keeps the total (`NinaUpkeepTotal`).
 */
export const NinaUpkeepCall = Schema.Struct({ input: Tokens, output: Tokens });

/** What the calls of one kind of upkeep spent in all: their tokens and how many calls. */
export const NinaUpkeepTotal = Schema.Struct({
  ...NinaUpkeepCall.fields,
  calls: Schema.Int.check(Schema.isGreaterThan(0)),
});
