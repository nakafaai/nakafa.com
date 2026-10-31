import { Schema } from "effect";

/**
 * The number a client gives one answer of one question. It grows with each
 * newer write, so the server can tell a write that was overtaken by another.
 */
export const Version = Schema.Int.check(Schema.isGreaterThan(0));
export type Version = typeof Version.Type;

/**
 * How one kind of write is admitted. A `live` deadline needs the server time before both
 * the attempt and the section deadline; an `attempt` deadline needs it before the attempt
 * deadline only. `allowance` is how many milliseconds past the deadline the write still
 * counts. `lock` says whether a proctor lock refuses the write. A policy owns its rule.
 */
export const Rule = Schema.Struct({
  allowance: Schema.Finite,
  deadline: Schema.Literals(["live", "attempt"]),
  lock: Schema.Literals(["refuse", "admit"]),
});
export type Rule = typeof Rule.Type;

/** The rules of the gate's own policies. */
export const rules = {
  answer: Rule.make({ allowance: 0, deadline: "live", lock: "refuse" }),
  finish: Rule.make({ allowance: 0, deadline: "attempt", lock: "refuse" }),
  flag: Rule.make({ allowance: 0, deadline: "live", lock: "refuse" }),
  paper: Rule.make({ allowance: 0, deadline: "attempt", lock: "admit" }),
  screen: Rule.make({ allowance: 0, deadline: "attempt", lock: "admit" }),
  signal: Rule.make({ allowance: 0, deadline: "attempt", lock: "admit" }),
  start: Rule.make({ allowance: 0, deadline: "attempt", lock: "refuse" }),
};
