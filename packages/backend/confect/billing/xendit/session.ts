import type { Docs } from "@repo/backend/confect/_generated/docs";
import {
  DatabaseReader,
  DatabaseWriter,
} from "@repo/backend/confect/_generated/services";
import {
  billingOffer,
  billingOfferPrice,
} from "@repo/backend/confect/billing/catalog";
import { scheduleProjection } from "@repo/backend/confect/billing/grants";
import { recordPayment } from "@repo/backend/confect/billing/payments";
import { applyInvoicePaid } from "@repo/backend/confect/billing/school";
import {
  BillingRowMissing,
  RailMismatch,
} from "@repo/backend/confect/billing/spec";
import {
  applySubscriptionState,
  readSubscriptionByXenditPlan,
} from "@repo/backend/confect/billing/subscriptions";
import { XenditSessionEvent } from "@repo/backend/confect/billing/xendit/contract";
import { systemActor } from "@repo/backend/confect/tenancy/actor";
import { Clock, DateTime, Effect, Option, Schema } from "effect";

const decodeSession = Schema.decodeUnknownOption(XenditSessionEvent);

/** The checkout a Xendit session belongs to, while it is still open. */
const readOpenCheckout = Effect.fn("billing.xendit.session.readCheckout")(
  function* (sessionId: string) {
    const checkout = yield* (yield* DatabaseReader)
      .table("billingCheckouts")
      .index("by_rail_and_sessionId", (query) =>
        query.eq("rail", "xendit").eq("sessionId", sessionId)
      )
      .first()
      .pipe(Effect.orDie);
    return Option.filter(checkout, (row) => row.status === "open");
  }
);

/** The account of a checkout, which a Xendit session can only name when it is a Xendit account. */
const readXenditAccount = Effect.fn("billing.xendit.session.readAccount")(
  function* (accountId: Docs["billingAccounts"]["_id"]) {
    const account = yield* (yield* DatabaseReader)
      .table("billingAccounts")
      .get(accountId)
      .pipe(
        Effect.catchTag("GetByIdFailure", () => Effect.succeed(null)),
        Effect.orDie
      );
    if (account === null) {
      return yield* new BillingRowMissing({
        table: "billingAccounts",
        message: `Account ${accountId} is gone.`,
      });
    }
    if (account.rail !== "xendit") {
      return yield* new RailMismatch({
        rail: account.rail,
        message: `Account ${accountId} is on ${account.rail}, not xendit.`,
      });
    }
    return account;
  }
);

/**
 * Records a paid pass once, and gives its owner Pro for the offer's months from
 * the moment Nakafa learns of the payment. Xendit names the payment once a pay
 * session completes; the session ID stands in when it does not.
 */
const applyPassPaid = Effect.fn("billing.xendit.session.passPaid")(function* (
  checkout: Docs["billingCheckouts"],
  paymentId: string
) {
  const account = yield* readXenditAccount(checkout.accountId);
  const offer = billingOffer(checkout.offer);
  const amount = billingOfferPrice(checkout.offer, account.currency);
  // Checkout opens a session only for a priced offer, so an unpriced one is a broken record.
  if (amount === null) {
    return yield* new BillingRowMissing({
      table: "billingCheckouts",
      message: `${checkout.offer} has no ${account.currency} price.`,
    });
  }
  const now = yield* Clock.currentTimeMillis;
  const recorded = yield* recordPayment({
    kind: "pass",
    accountId: account._id,
    status: "succeeded",
    amount,
    currency: account.currency,
    rail: "xendit",
    providerPaymentId: paymentId,
    providerUpdatedAt: now,
    method: "session",
    paidAt: now,
  });
  if (
    recorded.kind !== "recorded" ||
    account.owner.kind !== "personal" ||
    offer.product !== "pro"
  ) {
    return;
  }
  yield* (yield* DatabaseWriter)
    .table("billingGrants")
    .insert({
      product: "pro",
      userId: account.owner.userId,
      source: { kind: "pass", paymentId: recorded.paymentId },
      validFrom: now,
      validTo: DateTime.toEpochMillis(
        DateTime.add(DateTime.makeUnsafe(now), { months: offer.months })
      ),
    })
    .pipe(Effect.orDie);
  yield* scheduleProjection(account.owner);
});

/** Takes the payment link off an invoice that is still open. A paid invoice keeps the link it was paid on. */
const clearPaymentLink = Effect.fn("billing.xendit.session.clearLink")(
  function* (invoiceId: Docs["billingInvoices"]["_id"]) {
    const invoice = yield* (yield* DatabaseReader)
      .table("billingInvoices")
      .get(invoiceId)
      .pipe(Effect.orDie);
    if (invoice.status !== "open") {
      return;
    }
    yield* (yield* DatabaseWriter)
      .table("billingInvoices")
      .patch(invoiceId, { paymentLink: null })
      .pipe(Effect.orDie);
  }
);

/** Marks a checkout as ended, so a redelivered session event finds nothing open. */
const closeCheckout = Effect.fn("billing.xendit.session.close")(function* (
  checkout: Docs["billingCheckouts"],
  status: "completed" | "expired"
) {
  yield* (yield* DatabaseWriter)
    .table("billingCheckouts")
    .patch(checkout._id, { status })
    .pipe(Effect.orDie);
});

/**
 * A hosted session completed. A session that pays a school invoice pays the
 * invoice, and its School grant is written. Any other pay session is a paid pass:
 * its payment and its grant are written. A subscription session only linked the
 * buyer's account; the plan's own events activate and charge the subscription.
 */
export const applySessionCompleted = Effect.fn(
  "billing.xendit.session.completed"
)(function* (data: unknown) {
  const session = decodeSession(data);
  if (Option.isNone(session)) {
    return "invalid" as const;
  }
  const checkout = yield* readOpenCheckout(session.value.payment_session_id);
  if (Option.isNone(checkout)) {
    return "unknownSession" as const;
  }
  const paymentId =
    session.value.payment_id ?? session.value.payment_session_id;
  if (checkout.value.invoiceId !== null) {
    yield* applyInvoicePaid(systemActor, checkout.value.invoiceId, {
      method: "session",
      paidAt: yield* Clock.currentTimeMillis,
      providerPaymentId: paymentId,
    });
  } else if (session.value.session_type === "PAY") {
    yield* applyPassPaid(checkout.value, paymentId);
  }
  yield* closeCheckout(checkout.value, "completed");
  return "applied" as const;
});

/**
 * A hosted session closed unpaid. Its checkout ends, a subscription it was
 * opened for, which never became active, is canceled with it, and an invoice it
 * was opened for loses its payment link.
 */
export const applySessionExpired = Effect.fn("billing.xendit.session.expired")(
  function* (data: unknown) {
    const session = decodeSession(data);
    if (Option.isNone(session)) {
      return "invalid" as const;
    }
    const checkout = yield* readOpenCheckout(session.value.payment_session_id);
    if (Option.isNone(checkout)) {
      return "unknownSession" as const;
    }
    const planId = session.value.recurring_plan_id ?? null;
    const subscription =
      planId === null
        ? Option.none()
        : yield* readSubscriptionByXenditPlan(planId);
    if (
      Option.isSome(subscription) &&
      subscription.value.status === "pending"
    ) {
      const row = subscription.value;
      yield* applySubscriptionState({
        accountId: row.accountId,
        offer: row.offer,
        quantity: row.quantity,
        provider: row.provider,
        status: "canceled",
        cancelAtPeriodEnd: false,
        currentPeriodStart: row.currentPeriodStart,
        currentPeriodEnd: row.currentPeriodEnd,
        providerUpdatedAt: yield* Clock.currentTimeMillis,
      });
    }
    // An invoice whose payment closed unpaid loses its link, so the next request to pay opens another.
    if (checkout.value.invoiceId !== null) {
      yield* clearPaymentLink(checkout.value.invoiceId);
    }
    yield* closeCheckout(checkout.value, "expired");
    return "applied" as const;
  }
);
