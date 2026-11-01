import type { Docs } from "@repo/backend/confect/_generated/docs";
import billingInternal from "@repo/backend/confect/_generated/refs/billing.server";
import {
  DatabaseReader,
  DatabaseWriter,
  Scheduler,
} from "@repo/backend/confect/_generated/services";
import { endSubscriptionGrant } from "@repo/backend/confect/billing/grantEnd";
import { scheduleProjection } from "@repo/backend/confect/billing/grants";
import { readSubscription } from "@repo/backend/confect/billing/subscriptions";
import { XenditRefund } from "@repo/backend/confect/billing/xendit/contract";
import { refundLotOfPayment } from "@repo/backend/confect/credits/lots";
import {
  Array as Arr,
  DateTime,
  Duration,
  Effect,
  Match,
  Option,
  Schema,
} from "effect";

const decodeRefund = Schema.decodeUnknownOption(XenditRefund);

/** Ends a refunded pass at `endsAt`. A pass still waiting its turn never starts, and a later pass keeps its time. */
const endPass = Effect.fn("billing.xendit.refund.pass")(function* (
  payment: Docs["billingPayments"],
  endsAt: number
) {
  const reader = yield* DatabaseReader;
  const account = yield* reader
    .table("billingAccounts")
    .get(payment.accountId)
    .pipe(Effect.orDie);
  if (account.owner.kind !== "personal") {
    return;
  }
  const { userId } = account.owner;
  const grants = yield* reader
    .table("billingGrants")
    .index("by_userId_and_validTo", (query) =>
      query.eq("userId", userId).gt("validTo", endsAt)
    )
    .collect()
    .pipe(Effect.orDie);
  const grant = Arr.findFirst(
    grants,
    (row) => row.source.kind === "pass" && row.source.paymentId === payment._id
  );
  if (Option.isNone(grant)) {
    return;
  }
  yield* (yield* DatabaseWriter)
    .table("billingGrants")
    .patch(grant.value._id, {
      validTo: Math.max(endsAt, grant.value.validFrom),
    })
    .pipe(Effect.orDie);
  yield* scheduleProjection(account.owner);
});

/**
 * Ends the plan whose running period a refunded payment paid: Pro stops at
 * `endsAt`, and Xendit is asked to charge no further cycle. A refund of an
 * earlier cycle gives back time already used, so the running period stays. A
 * first month whose plan has not opened keeps it closed, since a canceled
 * subscription opens none.
 */
const endPlan = Effect.fn("billing.xendit.refund.plan")(function* (
  subscriptionId: Docs["billingSubscriptions"]["_id"],
  paidAt: number,
  endsAt: number
) {
  const subscription = yield* readSubscription(subscriptionId);
  if (
    subscription === null ||
    subscription.provider.kind !== "xendit" ||
    paidAt < subscription.currentPeriodStart
  ) {
    return;
  }
  yield* (yield* DatabaseWriter)
    .table("billingSubscriptions")
    .patch(subscriptionId, {
      cancelAtPeriodEnd: true,
      currentPeriodEnd: endsAt,
      providerUpdatedAt: endsAt,
      status: "canceled",
    })
    .pipe(Effect.orDie);
  yield* endSubscriptionGrant(subscriptionId, endsAt);
  if (subscription.provider.planId !== null) {
    yield* (yield* Scheduler).runAfter(
      Duration.zero,
      billingInternal.xendit.cancel.deactivate,
      { planId: subscription.provider.planId }
    );
  }
});

/**
 * Applies a refund Xendit completed, which an operator starts in its dashboard
 * or through its API: the payment reads refunded, and what it bought ends. A
 * pack loses its unused credits, a pass ends, and a plan whose running period it
 * paid stops. A School invoice stays paid, since a school's refund is a contract
 * matter an operator settles, and the refund is logged for them. A partial
 * refund changes nothing and is logged too: the buyer keeps what they bought. A
 * refund names its payment alone, so a payment Nakafa stored under its session
 * reads as unknown, and the event log shows it to an operator.
 */
export const applyRefund = Effect.fn("billing.xendit.refund.apply")(function* (
  data: unknown
) {
  const decoded = decodeRefund(data);
  if (Option.isNone(decoded)) {
    return "invalid" as const;
  }
  const refund = decoded.value;
  const stored = yield* (yield* DatabaseReader)
    .table("billingPayments")
    .index("by_rail_and_providerPaymentId", (query) =>
      query.eq("rail", "xendit").eq("providerPaymentId", refund.payment_id)
    )
    .first()
    .pipe(Effect.orDie);
  if (Option.isNone(stored)) {
    return "unknownPayment" as const;
  }
  const payment = stored.value;
  if (payment.status === "refunded") {
    return "duplicate" as const;
  }
  if (refund.amount < payment.amount) {
    yield* Effect.logWarning("A Xendit payment was refunded in part.", {
      amount: refund.amount,
      paid: payment.amount,
      refund: refund.refund_id,
    });
    return "partial" as const;
  }
  const refundedAt = DateTime.toEpochMillis(refund.updated);
  yield* (yield* DatabaseWriter)
    .table("billingPayments")
    .patch(payment._id, { status: "refunded", providerUpdatedAt: refundedAt })
    .pipe(Effect.orDie);
  yield* Match.value(payment).pipe(
    Match.when({ kind: "credits" }, (row) => refundLotOfPayment(row._id)),
    Match.when({ kind: "pass" }, (row) => endPass(row, refundedAt)),
    Match.when({ kind: "cycle" }, (row) =>
      endPlan(row.subscriptionId, row.paidAt, refundedAt)
    ),
    Match.when({ kind: "invoice" }, (row) =>
      Effect.logWarning("A School invoice paid through Xendit was refunded.", {
        invoice: row.invoiceId,
        refund: refund.refund_id,
      })
    ),
    Match.exhaustive
  );
  return "applied" as const;
});
