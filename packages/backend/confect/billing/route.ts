import {
  BillingCurrency,
  type BillingOfferKey,
  BillingOfferRailSchema,
  billingEuroTerritoryCodes,
  billingOffer,
  billingOfferPrice,
} from "@repo/backend/confect/billing/catalog";
import { Array as Arr, Config, Effect, HashSet, Option, Schema } from "effect";

/**
 * The value of the Indonesia rail switch. `passes` takes everything paid once
 * through Xendit and keeps the monthly plan on Polar, for as long as no live
 * Xendit channel can renew it. It is read only by this module.
 */
const IndonesiaRail = Schema.Literals(["polar", "passes", "xendit"]);

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
const BillingRoute = Schema.Struct({
  rail: BillingOfferRailSchema,
  currency: BillingCurrency,
  amount: Schema.Int,
});
type BillingRoute = typeof BillingRoute.Type;

/** The Indonesia switch from `BILLING_INDONESIA_RAIL`, which stays `polar` until Xendit sells there. */
export const readIndonesiaRail = Config.schema(
  IndonesiaRail,
  "BILLING_INDONESIA_RAIL"
).pipe(Config.withDefault("polar"));

/** Whether this deployment holds a Xendit secret key. The key itself is never read here. */
const isXenditConfigured = Effect.fn("billing.route.isXenditConfigured")(
  function* () {
    const key = yield* Config.option(
      Config.schema(Schema.Redacted(Schema.NonEmptyString), "XENDIT_API_KEY")
    );
    return Option.isSome(key);
  }
);

/**
 * Whether Xendit takes what Indonesian buyers pay once, such as a school's
 * invoice: the switch names Xendit, whole or under `passes`, and this deployment
 * holds the Xendit key. A switch that names no rail is logged and keeps Indonesia
 * where it was, on Polar.
 */
export const xenditTakesIndonesia = Effect.fn(
  "billing.route.xenditTakesIndonesia"
)(function* () {
  const rail = yield* readIndonesiaRail.pipe(
    Effect.catchTag("ConfigError", (error) =>
      Effect.logError("BILLING_INDONESIA_RAIL names no rail", {
        message: error.message,
      }).pipe(Effect.as("polar" as const))
    )
  );
  return rail !== "polar" && (yield* isXenditConfigured());
});

/** The rail of one offer in Indonesia while the switch names `passes`: what is paid once goes to Xendit. */
function railUnderPasses(offer: BillingOfferKey) {
  return billingOffer(offer).interval === "pass"
    ? ("xendit" as const)
    : ("polar" as const);
}

/**
 * Whether the offers of `currency` lead with the passes: rupiah under `passes`,
 * where the monthly plan needs a card, so a buyer without one starts on an offer
 * they can pay. A switch that names no rail keeps the catalog's order.
 */
export const passesLead = Effect.fn("billing.route.passesLead")(function* (
  currency: BillingCurrency
) {
  const rail = yield* readIndonesiaRail.pipe(
    Effect.catchTag("ConfigError", () => Effect.succeed("polar" as const))
  );
  return currency === "IDR" && rail === "passes";
});

/** The country Nakafa holds when it does not know the buyer's, because Polar decides it at checkout. */
export const UNKNOWN_COUNTRY = "ZZ";

/**
 * The country a learner checkout routes as, from the currency of the price the
 * learner was shown: rupiah is shown only in Indonesia, and any other currency
 * is a country Polar prices by the buyer's IP.
 */
export function checkoutCountryFor(currency: BillingCurrency): string {
  return currency === "IDR" ? "ID" : UNKNOWN_COUNTRY;
}

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
  const switched =
    country === "ID" ? yield* readIndonesiaRail : ("polar" as const);
  const preferred = switched === "passes" ? railUnderPasses(offer) : switched;
  const keysConfigured = yield* isXenditConfigured();
  const sellsOnPolar = Arr.contains(billingOffer(offer).rails, "polar");
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
  if (!Arr.contains(billingOffer(offer).rails, rail) || amount === null) {
    return yield* new OfferUnavailable({
      offer,
      rail,
      currency,
      message: `${offer} is not sold on ${rail} in ${currency}.`,
    });
  }
  return { amount, currency, rail } satisfies BillingRoute;
});
