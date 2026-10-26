import type { ActiveAppLocaleCode } from "@nakafa/aksara-contracts/locale";
import type { Docs } from "@repo/backend/confect/_generated/docs";
import refs from "@repo/backend/confect/_generated/refs";
import { MutationRunner } from "@repo/backend/confect/_generated/services";
import { billingOffer } from "@repo/backend/confect/billing/catalog";
import { getXenditCheckoutLocale } from "@repo/backend/confect/billing/locale";
import {
  type ProCheckoutOffer,
  XenditCheckoutError,
  xenditCheckoutErrorCode,
} from "@repo/backend/confect/billing/spec";
import type { XenditSessionRequest } from "@repo/backend/confect/billing/xendit/contract";
import { ensureCustomer } from "@repo/backend/confect/billing/xendit/customers";
import { createSession } from "@repo/backend/confect/billing/xendit/sessions";
import { randomUuid } from "@repo/utilities/uuid";
import { Clock, DateTime, Duration, Effect } from "effect";

type ProOffer = typeof ProCheckoutOffer.Type;
type XenditLocale = ReturnType<typeof getXenditCheckoutLocale>;

/** Xendit accepts no anchor day after the 28th, so a subscription started later in the month renews on the 28th. */
const LAST_ANCHOR_DAY = 28;

/** Western Indonesian Time, UTC+7, in which the day of an Indonesian subscription's renewal is read. */
const WIB_OFFSET_MS = Duration.toMillis(Duration.hours(7));

/** A failed renewal is charged again once a day, three times, and each failed attempt tells the buyer. */
const RENEWAL_RETRIES = 3;

/** What the buyer reads on Xendit's page for each Pro offer, in the page's language. */
const OFFER_DESCRIPTIONS = {
  en: {
    "pro.monthly": "Nakafa Pro, renews every month",
    "pro.pass.1": "Nakafa Pro for 1 month",
    "pro.pass.3": "Nakafa Pro for 3 months",
    "pro.pass.12": "Nakafa Pro for 12 months",
  },
  id: {
    "pro.monthly": "Nakafa Pro, diperpanjang setiap bulan",
    "pro.pass.1": "Nakafa Pro selama 1 bulan",
    "pro.pass.3": "Nakafa Pro selama 3 bulan",
    "pro.pass.12": "Nakafa Pro selama 12 bulan",
  },
} satisfies Record<XenditLocale, Record<ProOffer, string>>;

/**
 * The first renewal of a subscription that starts at `now` and renews every
 * `months` months: the same day in Western Indonesian Time, or the 28th when the
 * day is later. The first cycle is charged when the buyer links a channel, so
 * the renewal is one period after the checkout.
 */
export function renewalAnchor(now: number, months: number): string {
  const renewal = DateTime.makeUnsafe(now).pipe(
    DateTime.setZoneOffset(WIB_OFFSET_MS),
    DateTime.add({ months })
  );
  return DateTime.formatIsoOffset(
    DateTime.getPart(renewal, "day") > LAST_ANCHOR_DAY
      ? DateTime.setParts(renewal, { day: LAST_ANCHOR_DAY })
      : renewal
  );
}

/**
 * The hosted session one Pro offer opens. A pass is one payment through any
 * channel Xendit offers. A subscription links a channel Xendit can charge
 * again, charges the first month at once, renews monthly, and stops after a
 * renewal that fails every retry, so a lapsed buyer is never charged later.
 */
export function proSessionRequest(input: {
  readonly amount: number;
  readonly customerId: string;
  readonly locale: ActiveAppLocaleCode;
  readonly now: number;
  readonly offer: ProOffer;
  readonly referenceId: string;
  readonly returnUrl: string;
}): XenditSessionRequest {
  const offer = billingOffer(input.offer);
  const locale = getXenditCheckoutLocale(input.locale);
  const session = {
    reference_id: input.referenceId,
    mode: "PAYMENT_LINK",
    currency: "IDR",
    amount: input.amount,
    country: "ID",
    customer_id: input.customerId,
    description: OFFER_DESCRIPTIONS[locale][input.offer],
    locale,
    success_return_url: input.returnUrl,
    cancel_return_url: input.returnUrl,
  } as const;
  if (offer.interval === "pass") {
    return { ...session, session_type: "PAY" };
  }
  return {
    ...session,
    session_type: "SUBSCRIPTION",
    subscription: {
      schedule: {
        anchor_date: renewalAnchor(input.now, offer.months),
        interval: "MONTH",
        interval_count: offer.months,
        retry_interval: "DAY",
        retry_interval_count: 1,
        total_retry: RENEWAL_RETRIES,
        failed_attempt_notifications: [1, 2, RENEWAL_RETRIES],
      },
      failed_cycle_action: "STOP",
      immediate_payment: true,
    },
  };
}

/** A Xendit call of the checkout failed. Its cause is logged, and the learner sees the checkout failure. */
function xenditCheckoutFailure(cause: { readonly message: string }) {
  return Effect.logError("Xendit checkout failed", {
    message: cause.message,
  }).pipe(
    Effect.andThen(
      Effect.fail(
        new XenditCheckoutError({
          code: xenditCheckoutErrorCode,
          cause,
          message: "Failed to create checkout session.",
        })
      )
    )
  );
}

/**
 * Starts one Xendit hosted checkout for a learner's personal Xendit account. The
 * learner's Xendit customer is found or made first, and a session for the same
 * offer that is still open is reopened instead of a second one. The session is
 * recorded only once the account is admitted again, so a deletion that starts
 * meanwhile withholds it, and nobody holds the page of a withheld session.
 */
export const createXenditCheckout = Effect.fn("billing.xendit.checkout.create")(
  function* (input: {
    readonly amount: number;
    readonly appUserId: Docs["users"]["_id"];
    readonly locale: ActiveAppLocaleCode;
    readonly offer: ProOffer;
    readonly successUrl: string;
  }) {
    const { runMutation } = yield* MutationRunner;
    const prepared = yield* runMutation(
      refs.internal.billing.xendit.checkout.prepare,
      { offer: input.offer, userId: input.appUserId }
    ).pipe(Effect.catchTag("SchemaError", Effect.die));
    if (prepared.openUrl !== null) {
      return { url: prepared.openUrl };
    }
    const customerId = yield* prepared.providerCustomerId === null
      ? ensureCustomer({
          reference_id: prepared.authId,
          type: "INDIVIDUAL",
          individual_detail: { given_names: prepared.name },
          email: prepared.email,
        }).pipe(
          Effect.tap((id) =>
            runMutation(refs.internal.billing.checkout.recordCustomer, {
              accountId: prepared.accountId,
              providerCustomerId: id,
            }).pipe(Effect.orDie)
          )
        )
      : Effect.succeed(prepared.providerCustomerId);
    const session = yield* createSession(
      proSessionRequest({
        amount: input.amount,
        customerId,
        locale: input.locale,
        now: yield* Clock.currentTimeMillis,
        offer: input.offer,
        referenceId: yield* randomUuid,
        returnUrl: input.successUrl,
      })
    );
    if (session.payment_link_url === null) {
      return yield* xenditCheckoutFailure({
        message: `Session ${session.payment_session_id} has no payment link.`,
      });
    }
    yield* runMutation(refs.internal.billing.xendit.checkout.admit, {
      accountId: prepared.accountId,
      event: {
        name: "checkout started",
        properties: {
          checkout_locale: getXenditCheckoutLocale(input.locale),
          customer_ip_available: false,
          locale: input.locale,
          product_count: 1,
          product_id: input.offer,
          rail: "xendit",
        },
      },
      offer: input.offer,
      locale: input.locale,
      session: {
        sessionId: session.payment_session_id,
        url: session.payment_link_url,
        expiresAt: DateTime.toEpochMillis(session.expires_at),
        planId: session.recurring_plan_id,
      },
      userId: input.appUserId,
    }).pipe(Effect.catchTag("SchemaError", Effect.die));
    return { url: session.payment_link_url };
  },
  Effect.scoped,
  Effect.catchTags({
    ConfigError: xenditCheckoutFailure,
    XenditDecodeFailed: xenditCheckoutFailure,
    XenditRequestFailed: xenditCheckoutFailure,
  })
);
