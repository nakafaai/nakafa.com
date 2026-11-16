import type { Docs } from "@repo/backend/confect/_generated/docs";
import { Id } from "@repo/backend/confect/_generated/id";
import type { NinaCreditHold } from "@repo/backend/confect/nina/credits/schema";
import { Vendor, Work } from "@repo/backend/confect/spend/rates";
import { Schema } from "effect";

/** A whole number of micro-dollars, zero or more. */
const MicroUsd = Schema.Int.check(Schema.isGreaterThanOrEqualTo(0));

/** A calendar month (UTC), `YYYY-MM`. */
const Month = Schema.String.check(Schema.isPattern(/^\d{4}-\d{2}$/u));

/**
 * Who pays for a call: a school from the AI credits its plan grants, a learner
 * from their own plan and top-up packs, or Nakafa itself for work that belongs
 * to no account, such as embedding the published lessons.
 */
export const Payer = Schema.Union([
  Schema.Struct({ kind: Schema.Literal("school"), tenantId: Id("tenants") }),
  Schema.Struct({ kind: Schema.Literal("learner"), userId: Id("users") }),
  Schema.Struct({ kind: Schema.Literal("nakafa") }),
]);
export type Payer = typeof Payer.Type;

/**
 * Who a call is for, as its caller knows it. A `member` call is work a person
 * does in a school: the school pays when its plan grants AI credits, and the
 * person pays from their own account otherwise, the same rule that decides
 * where their Nina credits come from (`schoolPoolOf`). A `school` call is the
 * school's own work with no account behind it, which only its plan pays for.
 */
export const Claim = Schema.Union([
  Schema.Struct({
    kind: Schema.Literal("member"),
    tenantId: Id("tenants"),
    userId: Id("users"),
  }),
  Schema.Struct({ kind: Schema.Literal("school"), tenantId: Id("tenants") }),
  Schema.Struct({ kind: Schema.Literal("learner"), userId: Id("users") }),
  Schema.Struct({ kind: Schema.Literal("nakafa") }),
]);
export type Claim = typeof Claim.Type;

/**
 * What one payer spent with one vendor in one calendar month (UTC),
 * `YYYY-MM`, in micro-dollars, as far as `foldSpend` has counted the month's
 * escrows. `held` is what open calls hold before they settle, `spent` what
 * settled calls cost, and `calls` how many calls took a hold. A refund of
 * credits never lowers `spent`: the vendor was paid.
 */
export const vendorSpendValidator = Schema.Struct({
  payer: Payer,
  month: Month,
  vendor: Vendor,
  held: MicroUsd,
  spent: MicroUsd,
  calls: Schema.Int.check(Schema.isGreaterThanOrEqualTo(0)),
});

/**
 * What of an escrow its vendor row counts: nothing yet, its hold, or its cost
 * once it settled. `foldSpend` moves each escrow along, and an escrow whose row
 * counts its cost is done.
 */
export const Counted = Schema.Literals(["nothing", "hold", "cost"]);
export type Counted = typeof Counted.Type;

/**
 * One call's escrow: the payer, month and vendor whose row it counts toward,
 * the amount held before the call, and, once it settled, what it cost. An
 * escrow settles once. The call writes only its own escrow, and `foldSpend`
 * adds it to its row later, so two calls of one payer never write one document.
 */
export const vendorEscrowValidator = Schema.Struct({
  payer: Payer,
  month: Month,
  vendor: Vendor,
  work: Work,
  held: MicroUsd,
  state: Schema.Union([
    Schema.Struct({ status: Schema.Literal("held") }),
    Schema.Struct({ status: Schema.Literal("settled"), spent: MicroUsd }),
  ]),
  counted: Counted,
});

/** A call's escrow, as the caller holds it until it settles. */
export const Escrow = Schema.Struct({
  escrowId: Id("vendorEscrows"),
  held: MicroUsd,
});
export type Escrow = typeof Escrow.Type;

/**
 * The payer's month cannot hold the call: what it spent and holds, with this
 * call, would pass the budget its plan grants.
 */
export class SpendRefused extends Schema.TaggedError<
  SpendRefused,
  { readonly brand: unique symbol }
>()("SpendRefused", {
  vendor: Vendor,
  budget: MicroUsd,
  used: MicroUsd,
  held: MicroUsd,
}) {}

/**
 * Who a Nina turn's calls are for: the school whose pool its credits came
 * from, or its learner. Every call of the turn and of its follow-up work is
 * held against the same payer as its credits.
 */
export function turnClaim(
  turn: Pick<typeof NinaCreditHold.Type, "pool" | "userId">
): Claim {
  return turn.pool === undefined
    ? { kind: "learner", userId: turn.userId }
    : { kind: "member", tenantId: turn.pool.tenantId, userId: turn.userId };
}

/**
 * Who a person's work in a school is for: the person as a member when an
 * account holds them, and the school alone when none does yet.
 */
export function personClaim(
  person: Pick<Docs["tenantPeople"], "account">,
  tenantId: Docs["tenants"]["_id"]
): Claim {
  return person.account.state === "claimed"
    ? { kind: "member", tenantId, userId: person.account.userId }
    : { kind: "school", tenantId };
}
