import type { Docs } from "@repo/backend/confect/_generated/docs";
import refs from "@repo/backend/confect/_generated/refs";
import {
  DatabaseReader,
  DatabaseWriter,
  Scheduler,
} from "@repo/backend/confect/_generated/services";
import {
  billingOffer,
  billingOfferPrice,
} from "@repo/backend/confect/billing/catalog";
import {
  latestPersonalGrant,
  scheduleProjection,
  syncSubscriptionGrant,
} from "@repo/backend/confect/billing/grants";
import { recordPayment } from "@repo/backend/confect/billing/payments";
import { applyInvoicePaid } from "@repo/backend/confect/billing/school";
import {
  BillingRowMissing,
  RailMismatch,
} from "@repo/backend/confect/billing/spec";
import { applySubscriptionState } from "@repo/backend/confect/billing/subscriptions";
import { XenditSessionEvent } from "@repo/backend/confect/billing/xendit/contract";
import { renewalAnchor } from "@repo/backend/confect/billing/xendit/renewal";
import { systemActor } from "@repo/backend/confect/tenancy/actor";
import { Clock, DateTime, Duration, Effect, Option, Schema } from "effect";

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

/** How long before a pass ends its owner is reminded, in the language they bought it in. */
const PASS_REMINDER_LEAD_MS = Duration.toMillis(Duration.days(3));

/**
 * Records a paid pass once, and gives its owner Pro for the offer's months from
 * the moment Nakafa learns of the payment, or from the end of the Pro they still
 * hold. Xendit names the payment once a pay
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
  // A pass bought while Pro still runs starts where that Pro ends, so the learner loses no day of either.
  const start = Option.match(
    yield* latestPersonalGrant(account.owner.userId, now),
    { onNone: () => now, onSome: (grant) => Math.max(now, grant.validTo) }
  );
  const end = DateTime.toEpochMillis(
    DateTime.add(DateTime.makeUnsafe(start), { months: offer.months })
  );
  const grantId = yield* (yield* DatabaseWriter)
    .table("billingGrants")
    .insert({
      product: "pro",
      userId: account.owner.userId,
      source: { kind: "pass", paymentId: recorded.paymentId },
      validFrom: start,
      validTo: end,
    })
    .pipe(Effect.orDie);
  yield* (yield* Scheduler).runAt(
    DateTime.makeUnsafe(Math.max(now, end - PASS_REMINDER_LEAD_MS)),
    refs.internal.billing.reminder.delivery.deliver,
    { grantId, locale: checkout.locale }
  );
  yield* scheduleProjection(account.owner);
});

/**
 * Starts the subscription of a paid first month: the subscription runs until
 * its first renewal, the payment is recorded as its first cycle, Pro is granted
 * for the period, and the recurring plan that charges the saved channel opens in
 * the background, in the language of the checkout.
 */
const applyFirstMonthPaid = Effect.fn("billing.xendit.session.firstMonthPaid")(
  function* (
    checkout: Docs["billingCheckouts"],
    paymentId: string,
    tokenId: string | null
  ) {
    const account = yield* readXenditAccount(checkout.accountId);
    const amount = billingOfferPrice(checkout.offer, account.currency);
    // Checkout opens a session only for a priced offer, so an unpriced one is a broken record.
    if (amount === null) {
      return yield* new BillingRowMissing({
        table: "billingCheckouts",
        message: `${checkout.offer} has no ${account.currency} price.`,
      });
    }
    const now = yield* Clock.currentTimeMillis;
    const { subscriptionId } = yield* applySubscriptionState({
      accountId: account._id,
      offer: checkout.offer,
      quantity: 1,
      status: "active",
      currentPeriodStart: now,
      currentPeriodEnd: DateTime.toEpochMillis(
        renewalAnchor(now, billingOffer(checkout.offer).months)
      ),
      cancelAtPeriodEnd: false,
      provider: { kind: "xendit", planId: null, tokenId, channel: null },
      providerUpdatedAt: now,
    });
    yield* recordPayment({
      kind: "cycle",
      subscriptionId,
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
    yield* syncSubscriptionGrant(subscriptionId);
    if (tokenId === null) {
      return yield* Effect.logError(
        "A first month was paid without a saved channel, so its plan cannot open",
        { subscriptionId }
      );
    }
    yield* (yield* Scheduler).runAfter(
      Duration.zero,
      refs.internal.billing.xendit.renewal.open,
      { locale: checkout.locale, subscriptionId }
    );
  }
);

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
 * invoice, and its School grant is written. A pass is recorded and granted. The
 * monthly plan's first month starts its subscription: the payment, Pro until
 * the first renewal, and the recurring plan that charges the channel the
 * session saved.
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
  } else if (billingOffer(checkout.value.offer).interval === "pass") {
    yield* applyPassPaid(checkout.value, paymentId);
  } else {
    yield* applyFirstMonthPaid(
      checkout.value,
      paymentId,
      session.value.payment_token_id ?? null
    );
  }
  yield* closeCheckout(checkout.value, "completed");
  return "applied" as const;
});

/**
 * A hosted session closed unpaid. Its checkout ends, and an invoice it was
 * opened for loses its payment link; nothing else was ever written for it.
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
    // An invoice whose payment closed unpaid loses its link, so the next request to pay opens another.
    if (checkout.value.invoiceId !== null) {
      yield* clearPaymentLink(checkout.value.invoiceId);
    }
    yield* closeCheckout(checkout.value, "expired");
    return "applied" as const;
  }
);
