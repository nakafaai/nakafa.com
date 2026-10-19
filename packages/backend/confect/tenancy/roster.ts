import { Schema } from "effect";

/**
 * How one Person stands with the school, as the members list shows it. A Person
 * whose account is claimed has joined. An unclaimed Person waits on a pending
 * invite, or holds a login card, or has neither yet.
 */
export const MemberStatus = Schema.Literals([
  "cardIssued",
  "invited",
  "joined",
  "notInvited",
]);
export type MemberStatus = typeof MemberStatus.Type;

/** The facts of one Person that decide its status: whether an account claimed it, and what waits for it. */
const MemberFacts = Schema.Struct({
  carded: Schema.Boolean,
  claimed: Schema.Boolean,
  invited: Schema.Boolean,
});

/**
 * The status of one Person, decided in order: a claimed Person has joined, a
 * pending invite comes next, then a login card, and a Person with none of them is
 * not invited yet. The members list reads the facts and this function decides.
 */
export function memberStatusOf(facts: typeof MemberFacts.Type): MemberStatus {
  if (facts.claimed) {
    return "joined";
  }
  if (facts.invited) {
    return "invited";
  }
  if (facts.carded) {
    return "cardIssued";
  }
  return "notInvited";
}
