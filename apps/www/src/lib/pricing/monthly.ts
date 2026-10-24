import { billingEuroTerritoryCodes } from "@repo/backend/confect/billing/catalog";
import { monthlyPrices } from "@repo/backend/confect/billing/polar/catalog";
import { HashSet, Schema } from "effect";

/** The currencies that the monthly pro price is shown in, as the Polar catalog names them. */
export const PricingCurrencySchema = Schema.Literals(["EUR", "IDR", "USD"]);

export type PricingCurrency = typeof PricingCurrencySchema.Type;

type MonthlyPrice = (typeof monthlyPrices)[keyof typeof monthlyPrices];

/** Builds the shared formatting contract for one catalog price. */
function getPriceFormat(price: MonthlyPrice) {
  return {
    currency: price.currency,
    maximumFractionDigits: price.fractionDigits,
    minimumFractionDigits: price.fractionDigits,
    style: "currency",
  } satisfies Intl.NumberFormatOptions;
}

/** The price of one currency with its formatting, as the pages read it. */
function makePricing<Currency extends PricingCurrency>(
  currency: Currency,
  price: MonthlyPrice
) {
  const format = getPriceFormat(price);
  return {
    currency,
    format,
    formatter: new Intl.NumberFormat(price.locale, format),
    price,
  };
}

const eurPricing = makePricing("EUR", monthlyPrices.EUR);
const idrPricing = makePricing("IDR", monthlyPrices.IDR);
const usdPricing = makePricing("USD", monthlyPrices.USD);

/** The monthly pro price of every currency, which the static page carries in full. */
const pricingByCurrency = {
  EUR: eurPricing,
  IDR: idrPricing,
  USD: usdPricing,
} satisfies Record<PricingCurrency, unknown>;

/** The monthly pro price of one currency, with its formatting. */
export function getProMonthlyPricingFor(currency: PricingCurrency) {
  return pricingByCurrency[currency];
}

/** Selects the Polar catalog price, with its currency, for the request country. */
export function getProMonthlyPricing(countryCode: string | null) {
  const normalizedCountryCode = countryCode?.toUpperCase();

  if (normalizedCountryCode === "ID") {
    return idrPricing;
  }

  if (
    normalizedCountryCode &&
    HashSet.has(billingEuroTerritoryCodes, normalizedCountryCode)
  ) {
    return eurPricing;
  }

  return usdPricing;
}
