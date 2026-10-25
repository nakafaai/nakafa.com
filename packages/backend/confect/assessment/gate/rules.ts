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
 * deadline only; an `elapsed` deadline needs it at or after the attempt deadline, which is
 * how a scheduled expiry is admitted. `lock` says whether a proctor lock refuses the write.
 * A policy owns its rule.
 */
export const Rule = Schema.Struct({
  deadline: Schema.Literals(["live", "attempt", "elapsed"]),
  lock: Schema.Literals(["refuse", "admit"]),
});
export type Rule = typeof Rule.Type;

/** The rules of the gate's own policies. */
export const rules = {
  answer: Rule.make({ deadline: "live", lock: "refuse" }),
  expire: Rule.make({ deadline: "elapsed", lock: "admit" }),
  finish: Rule.make({ deadline: "attempt", lock: "refuse" }),
  flag: Rule.make({ deadline: "live", lock: "refuse" }),
  paper: Rule.make({ deadline: "attempt", lock: "admit" }),
  signal: Rule.make({ deadline: "attempt", lock: "admit" }),
  start: Rule.make({ deadline: "attempt", lock: "refuse" }),
};
