import { FunctionSpec, GroupSpec } from "@confect/core";
import { Id } from "@repo/backend/confect/_generated/id";
import { Schema } from "effect";

export const NinaUsage = Schema.Struct({
  agent: Schema.Literals([
    "nina",
    "nakafa",
    "research",
    "math",
    "math-repair",
    "suggestions",
    "summary",
    "title",
    "nina-repair",
  ]),
  model: Schema.NonEmptyString,
  provider: Schema.NonEmptyString,
  input: Schema.Int.check(Schema.isGreaterThanOrEqualTo(0)),
  output: Schema.Int.check(Schema.isGreaterThanOrEqualTo(0)),
});

export const NinaUsageTotal = Schema.Struct({
  ...NinaUsage.fields,
  calls: Schema.Int.check(Schema.isGreaterThan(0)),
});

export default GroupSpec.make().addFunction(
  FunctionSpec.internalMutation({
    name: "record",
    args: () => ({ turnId: Id("ninaTurns"), usage: NinaUsage }),
    returns: () => Schema.Null,
  })
);
