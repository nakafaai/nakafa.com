import {
  type BillingCurrency,
  type BillingOfferKey,
  type BillingOfferRail,
  billingEuroTerritoryCodes,
  billingOffer,
  billingOfferPrice,
} from "@repo/backend/confect/billing/catalog";
import { Config, Effect, HashSet, Option, Schema } from "effect";

/** The value of the Indonesia rail switch. It is read only by this module. */
export const IndonesiaRail = Schema.Literals(["polar", "xendit"]);
export type IndonesiaRail = typeof IndonesiaRail.Type;

/** An offer the chosen rail or currency does not sell, so no checkout can start. */
export class OfferUnavailable extends Schema.TaggedError<OfferUnavailable>()(
  "OfferUnavailable",
  {
    offer: Schema.String,
    rail: Schema.String,
    currency: Schema.String,
    message: Schema.String,
  }
) {}

/** A Xendit checkout was requested while this deployment holds no Xendit key. */
export class XenditNotConfigured extends Schema.TaggedError<XenditNotConfigured>()(
  "XenditNotConfigured",
  {
    message: Schema.String,
  }
) {}

/** The routed checkout: the rail that takes the money, the currency, and the amount in minor units. */
export interface BillingRoute {
  readonly amount: number;
  readonly currency: BillingCurrency;
  readonly rail: BillingOfferRail;
}

/** The Indonesia switch from `BILLING_INDONESIA_RAIL`, which stays `polar` until Xendit is live. */
export const readIndonesiaRail = Config.schema(
  IndonesiaRail,
  "BILLING_INDONESIA_RAIL"
).pipe(Config.withDefault("polar"));

/** Whether this deployment holds a Xendit secret key. The key itself is never read here. */
const isXenditConfigured = Effect.fn("billing.route.isXenditConfigured")(
  function* () {
    const key = yield* Config.option(
      Config.schema(Schema.Redacted(Schema.NonEmptyString), "XENDIT_SECRET_KEY")
    );
    return Option.isSome(key);
  }
);

/** The currency an account in `country` bills in: IDR in Indonesia, EUR in the euro territories, USD elsewhere. */
export function billingCurrencyFor(country: string): BillingCurrency {
  if (country === "ID") {
    return "IDR";
  }
  return HashSet.has(billingEuroTerritoryCodes, country) ? "EUR" : "USD";
}

/**
 * Picks the rail and the price of one offer for a buyer in `country`. Indonesia
 * follows the switch, every other country is Polar. When the switch names
 * Xendit but the deployment holds no Xendit key, an offer Polar also sells falls
 * back to Polar, and an offer only Xendit sells fails as `XenditNotConfigured`.
 */
export const routeOffer = Effect.fn("billing.route.routeOffer")(function* (
  country: string,
  offer: BillingOfferKey
) {
  const currency = billingCurrencyFor(country);
  const preferred =
    country === "ID" ? yield* readIndonesiaRail : ("polar" as const);
  const keysConfigured = yield* isXenditConfigured();
  const sellsOnPolar = billingOffer(offer).rails.includes("polar");
  const rail =
    preferred === "xendit" && !keysConfigured && sellsOnPolar
      ? "polar"
      : preferred;
  if (rail === "xendit" && !keysConfigured) {
    return yield* new XenditNotConfigured({
      message: "Xendit checkout needs the Xendit secret key.",
    });
  }
  const amount = billingOfferPrice(offer, currency);
  if (!billingOffer(offer).rails.includes(rail) || amount === null) {
    return yield* new OfferUnavailable({
      offer,
      rail,
      currency,
      message: `${offer} is not sold on ${rail} in ${currency}.`,
    });
  }
  return { amount, currency, rail } satisfies BillingRoute;
});
