import type { Purpose } from "@repo/backend/confect/gateway/purpose";
import { Record, Schema } from "effect";

/** US dollars: finite and zero or more. */
const Dollars = Schema.Finite.check(Schema.isGreaterThanOrEqualTo(0));

/** A token count: a whole number, zero or more. */
const Tokens = Schema.Int.check(Schema.isGreaterThanOrEqualTo(0));

/**
 * Every agent whose model calls the usage ledger records, with the purpose its
 * calls run under. The purpose sets the most one call may write, so the release
 * gate reads its caps from here. This table is the one list of agent names: the
 * ledger accepts exactly these, and an Agent named anything else records no
 * usage. A capability's runner names its Agent here with `satisfies UsageAgent`.
 */
const AGENT_PURPOSES = {
  nina: "chat",
  nakafa: "specialist",
  research: "specialist",
  math: "specialist",
  "math-repair": "background",
  suggestions: "suggestion",
  title: "presentation",
  "nina-repair": "background",
  memory: "background",
  summary: "background",
} satisfies Record.ReadonlyRecord<string, Purpose>;

const UsageAgentSchema = Schema.Literals(Record.keys(AGENT_PURPOSES));

/** The name of an agent the usage ledger records. */
export type UsageAgent = typeof UsageAgentSchema.Type;

/** The purpose a ledger agent's calls run under. */
export function purposeOf(agent: UsageAgent) {
  return AGENT_PURPOSES[agent];
}

export const NinaUsage = Schema.Struct({
  agent: UsageAgentSchema,
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
