import { Schema } from "effect";

/**
 * The number a client gives one answer of one question. It grows with each
 * newer write, so the server can tell a write that was overtaken by another.
 */
export const Version = Schema.Int.check(Schema.isGreaterThan(0));
export type Version = typeof Version.Type;

/**
 * How one kind of write is admitted. A `live` deadline needs the server time
 * before both the attempt and the section deadline and is checked once the
 * section is open and verified, before the rest of its rows load; an `attempt`
 * deadline needs it before the attempt deadline and is checked before the
 * section loads. `lock` says whether a proctor lock refuses the write. A
 * policy owns its rule; an adapter may define its own.
 */
export const Rule = Schema.Struct({
  deadline: Schema.Literals(["live", "attempt"]),
  lock: Schema.Literals(["refuse", "admit"]),
});
export type Rule = typeof Rule.Type;

/** The rules of the gate's own policies. */
export const rules = {
  answer: Rule.make({ deadline: "live", lock: "refuse" }),
  finish: Rule.make({ deadline: "attempt", lock: "refuse" }),
};
