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
import { DateTime, Effect } from "effect";

type ProOffer = typeof ProCheckoutOffer.Type;
type XenditLocale = ReturnType<typeof getXenditCheckoutLocale>;

/** What the buyer reads on Xendit's page and in Xendit's messages for each Pro offer, in the page's language. */
export const OFFER_DESCRIPTIONS = {
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
 * The hosted session one Pro offer opens: one payment through any channel
 * Xendit offers for a pass, and for the monthly plan the first month through a
 * channel Xendit saves, which the recurring plan opened after the payment
 * charges every month after.
 */
export function proSessionRequest(input: {
  readonly amount: number;
  readonly customerId: string;
  readonly locale: ActiveAppLocaleCode;
  readonly offer: ProOffer;
  readonly referenceId: string;
  readonly returnUrl: string;
}): XenditSessionRequest {
  const locale = getXenditCheckoutLocale(input.locale);
  const session = {
    reference_id: input.referenceId,
    session_type: "PAY",
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
  return billingOffer(input.offer).interval === "pass"
    ? session
    : { ...session, allow_save_payment_method: "FORCED" };
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
        offer: input.offer,
        referenceId: yield* randomUuid,
        returnUrl: input.successUrl,
      })
    );
    const url = session.payment_link_url ?? null;
    if (url === null) {
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
        url,
        expiresAt: DateTime.toEpochMillis(session.expires_at),
      },
      userId: input.appUserId,
    }).pipe(Effect.catchTag("SchemaError", Effect.die));
    return { url };
  },
  Effect.scoped,
  Effect.catchTags({
    ConfigError: xenditCheckoutFailure,
    XenditDecodeFailed: xenditCheckoutFailure,
    XenditRequestFailed: xenditCheckoutFailure,
  })
);
