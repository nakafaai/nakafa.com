/**
 * What Nakafa sells: every offer, the product it belongs to, its price in each
 * currency it is sold in, and the rails that sell it. Prices are in the
 * currency's minor unit (rupiah, cents), so a price never passes through a
 * float. Browser code imports this module, so it reads no secret and no server
 * setting.
 */
import { HashSet, Schema } from "effect";

/** The currencies an account bills in: IDR in Indonesia, EUR in the euro territories, USD elsewhere. */
export const BillingCurrency = Schema.Literals(["EUR", "IDR", "USD"]);
export type BillingCurrency = typeof BillingCurrency.Type;

/** The rails that sell an offer. Polar is merchant of record outside Indonesia. */
export const BillingOfferRailSchema = Schema.Literals(["polar", "xendit"]);

/** One offer: what it grants, how it bills, what it costs, and where it is sold. */
const BillingOffer = Schema.Struct({
  /** `month` and `year` recur. `pass` is paid once for `months` months. */
  interval: Schema.Literals(["month", "pass", "year"]),
  months: Schema.Int,
  prices: Schema.Struct({
    EUR: Schema.optionalKey(Schema.Int),
    IDR: Schema.optionalKey(Schema.Int),
    USD: Schema.optionalKey(Schema.Int),
  }),
  product: Schema.Literals(["credits", "pro", "school"]),
  rails: Schema.Array(BillingOfferRailSchema),
});
type BillingOffer = typeof BillingOffer.Type;
/** The key of every offer, the value a stored subscription or grant names. */
export const BillingOfferKey = Schema.Literals([
  "pro.monthly",
  "pro.yearly",
  "pro.pass.1",
  "pro.pass.3",
  "pro.pass.12",
  "pro.topup",
  "school.seat.month",
  "school.seat.semester",
  "school.seat.year",
]);
export type BillingOfferKey = typeof BillingOfferKey.Type;

/** The monthly Pro price in each currency, in minor units. The catalog and the pages both read this one fact. */
export const proMonthlyPrices = { EUR: 899, IDR: 79_000, USD: 899 } as const;

const billingOffers = {
  "pro.monthly": {
    interval: "month",
    months: 1,
    prices: proMonthlyPrices,
    product: "pro",
    rails: ["polar", "xendit"],
  },
  "pro.yearly": {
    interval: "year",
    months: 12,
    prices: { EUR: 8990, IDR: 790_000, USD: 8990 },
    product: "pro",
    rails: ["polar"],
  },
  "pro.pass.1": {
    interval: "pass",
    months: 1,
    prices: { IDR: 79_000 },
    product: "pro",
    rails: ["xendit"],
  },
  "pro.pass.3": {
    interval: "pass",
    months: 3,
    prices: { IDR: 229_000 },
    product: "pro",
    rails: ["xendit"],
  },
  "pro.pass.12": {
    interval: "pass",
    months: 12,
    prices: { IDR: 790_000 },
    product: "pro",
    rails: ["xendit"],
  },
  "pro.topup": {
    interval: "pass",
    months: 1,
    prices: { EUR: 499, IDR: 59_000, USD: 499 },
    product: "credits",
    rails: ["polar", "xendit"],
  },
  "school.seat.month": {
    interval: "month",
    months: 1,
    prices: { EUR: 100, USD: 100 },
    product: "school",
    rails: ["polar"],
  },
  "school.seat.semester": {
    interval: "pass",
    months: 6,
    prices: { IDR: 60_000 },
    product: "school",
    rails: ["xendit"],
  },
  "school.seat.year": {
    interval: "year",
    months: 12,
    prices: { EUR: 1000, IDR: 100_000, USD: 1000 },
    product: "school",
    rails: ["polar", "xendit"],
  },
} satisfies Record<BillingOfferKey, BillingOffer>;

/** One offer's definition, typed as the shape every offer shares. */
export function billingOffer(offer: BillingOfferKey): BillingOffer {
  return billingOffers[offer];
}

/** The price of one offer in one currency, or null when the offer is not priced in it. */
export function billingOfferPrice(
  offer: BillingOfferKey,
  currency: BillingCurrency
): number | null {
  return billingOffer(offer).prices[currency] ?? null;
}

/**
 * Territory codes that Polar maps to EUR through Babel's territory currency
 * data. Keeping the same mapping keeps the displayed price and the checkout
 * currency equal. Sources:
 * - https://github.com/polarsource/polar/blob/11d0edae5ebad634a21c8fbe6bafc5626055951e/server/polar/kit/currency.py
 * - https://github.com/polarsource/polar/blob/11d0edae5ebad634a21c8fbe6bafc5626055951e/server/tests/kit/test_currency.py
 */
export const billingEuroTerritoryCodes = HashSet.fromIterable([
  "AD",
  "AT",
  "AX",
  "BE",
  "BL",
  "CY",
  "DE",
  "EA",
  "EE",
  "ES",
  "EU",
  "FI",
  "FR",
  "GF",
  "GP",
  "GR",
  "HR",
  "IC",
  "IE",
  "IT",
  "LT",
  "LU",
  "LV",
  "MC",
  "ME",
  "MF",
  "MQ",
  "MT",
  "NL",
  "PM",
  "PT",
  "RE",
  "SI",
  "SK",
  "SM",
  "TF",
  "VA",
  "XK",
  "YT",
]);
