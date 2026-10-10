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
