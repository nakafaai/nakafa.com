import { Array as Arr, Schema } from "effect";
import {
  pricingCurrencyCookieName,
  proMonthlyPricings,
} from "@/components/marketing/about/pricing/display";

/** The root attribute that the script writes and the price styles read. */
export const PRICING_CURRENCY_ROOT_ATTRIBUTE = "data-currency";

const StringJsonSchema = Schema.fromJsonString(Schema.String);
const StringListJsonSchema = Schema.fromJsonString(Schema.Array(Schema.String));

/** Writes one constant as a JavaScript string literal inside the script. */
const literal = (value: string) => Schema.encodeSync(StringJsonSchema)(value);

/** Writes a list of constants as a JavaScript array literal inside the script. */
const listLiteral = (values: readonly string[]) =>
  Schema.encodeSync(StringListJsonSchema)(values);

const PRICING_CURRENCIES = Arr.map(
  proMonthlyPricings,
  (pricing) => pricing.price.currency
);

/**
 * The inline script of the root layout. It runs while the document is parsed,
 * before the prices are, and marks the root with the visitor's currency from the
 * cookie that the proxy sets. A header without that cookie, or a value that names
 * no known currency, leaves the root unmarked, so the styles show USD. A cookie
 * that cannot be read keeps the same default.
 *
 * The script refers to nothing outside its text: the cookie name and the currency
 * list are written into it as literals, and the root attribute is one constant.
 */
export const PRICING_CURRENCY_SCRIPT = `(function () {
  try {
    var prefix = ${literal(`${pricingCurrencyCookieName}=`)};
    var currencies = ${listLiteral(PRICING_CURRENCIES)};
    var pairs = document.cookie.split(";");
    for (var index = 0; index < pairs.length; index++) {
      var entry = pairs[index].trim();
      if (entry.indexOf(prefix) === 0) {
        var currency = entry.slice(prefix.length);
        if (currencies.indexOf(currency) !== -1) {
          document.documentElement.setAttribute(${literal(PRICING_CURRENCY_ROOT_ATTRIBUTE)}, currency);
        }
        break;
      }
    }
  } catch (error) {
    // A cookie that cannot be read keeps the USD default.
  }
})();`;
