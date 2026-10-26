import type { Docs } from "@repo/backend/confect/_generated/docs";
import {
  DatabaseReader,
  DatabaseWriter,
} from "@repo/backend/confect/_generated/services";
import {
  billingOffer,
  billingOfferPrice,
} from "@repo/backend/confect/billing/catalog";
import {
  latestPersonalGrant,
  scheduleProjection,
} from "@repo/backend/confect/billing/grants";
import { recordPayment } from "@repo/backend/confect/billing/payments";
import {
  BillingRowMissing,
  RailMismatch,
} from "@repo/backend/confect/billing/spec";
import {
  applySubscriptionState,
  readSubscriptionByXenditPlan,
} from "@repo/backend/confect/billing/subscriptions";
import { XenditSessionEvent } from "@repo/backend/confect/billing/xendit/contract";
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
  yield* (yield* DatabaseWriter)
    .table("billingGrants")
    .insert({
      product: "pro",
      userId: account.owner.userId,
      source: { kind: "pass", paymentId: recorded.paymentId },
      validFrom: start,
      validTo: DateTime.toEpochMillis(
        DateTime.add(DateTime.makeUnsafe(start), { months: offer.months })
      ),
    })
    .pipe(Effect.orDie);
  yield* scheduleProjection(account.owner);
});

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
 * A hosted session completed. A pay session is a paid pass: its payment and its
 * grant are written. A subscription session only linked the buyer's account; the
 * plan's own events activate and charge the subscription.
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
  if (session.value.session_type === "PAY") {
    yield* applyPassPaid(
      checkout.value,
      session.value.payment_id ?? session.value.payment_session_id
    );
  }
  yield* closeCheckout(checkout.value, "completed");
  return "applied" as const;
});

/**
 * A hosted session closed unpaid. Its checkout ends, and a subscription it was
 * opened for, which never became active, is canceled with it.
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
    yield* closeCheckout(checkout.value, "expired");
    return "applied" as const;
  }
);
