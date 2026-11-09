import {
  proMonthlyPrices,
  proYearlyPrices,
} from "@repo/backend/confect/billing/catalog";
import { currencyOfCountry } from "@repo/backend/confect/country/registry";
import {
  currencySymbol,
  formatCurrency,
} from "@repo/internationalization/src/money";
import { Schema } from "effect";

/** The currencies that the monthly pro price is shown in, as the Polar catalog names them. */
export const PricingCurrencySchema = Schema.Literals([
  "EUR",
  "IDR",
  "MYR",
  "USD",
]);

export type PricingCurrency = typeof PricingCurrencySchema.Type;

/** One monthly price as the pages show it: the amount in major units, the yearly amount beside it, with its currency, digits and locale. */
const MonthlyPriceSchema = Schema.Struct({
  amount: Schema.Finite,
  currency: PricingCurrencySchema,
  fractionDigits: Schema.Int,
  locale: Schema.String,
  yearlyAmount: Schema.Finite,
});

type MonthlyPrice = typeof MonthlyPriceSchema.Type;

/** The monthly and yearly prices in one currency: the catalog's minor units, shown in the currency's own digits. */
function monthlyPriceOf(
  currency: PricingCurrency,
  fractionDigits: number,
  locale: string
): MonthlyPrice {
  return {
    amount: proMonthlyPrices[currency] / 10 ** fractionDigits,
    currency,
    fractionDigits,
    locale,
    yearlyAmount: proYearlyPrices[currency] / 10 ** fractionDigits,
  };
}

/** The price of one currency with its formatting, as the pages read it. */
function makePricing<Currency extends PricingCurrency>(
  currency: Currency,
  price: MonthlyPrice
) {
  return {
    currency,
    format: (amount: number) =>
      formatCurrency(amount, {
        currency,
        digits: price.fractionDigits,
        locale: price.locale,
      }),
    price,
    get symbol() {
      return currencySymbol(currency, price.locale);
    },
  };
}

const eurPricing = makePricing("EUR", monthlyPriceOf("EUR", 2, "de-DE"));
const idrPricing = makePricing("IDR", monthlyPriceOf("IDR", 0, "id-ID"));
const myrPricing = makePricing("MYR", monthlyPriceOf("MYR", 2, "ms-MY"));
const usdPricing = makePricing("USD", monthlyPriceOf("USD", 2, "en-US"));

/** The monthly pro price of every currency, which the static page carries in full. */
const pricingByCurrency = {
  EUR: eurPricing,
  IDR: idrPricing,
  MYR: myrPricing,
  USD: usdPricing,
} satisfies Record<PricingCurrency, unknown>;

/** The pro price in every currency, rupiah first, as a price list states them. */
export const proPricing = [
  idrPricing,
  myrPricing,
  usdPricing,
  eurPricing,
] as const;

/** The monthly pro price of one currency, with its formatting. */
export function getProMonthlyPricingFor(currency: PricingCurrency) {
  return pricingByCurrency[currency];
}

/** Selects the catalog price, with its currency, for the request country, as the country registry bills it. */
export function getProMonthlyPricing(countryCode: string | null) {
  return pricingByCurrency[currencyOfCountry(countryCode?.toUpperCase() ?? "")];
}
