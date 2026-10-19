import { readCookie } from "@repo/internationalization/src/cookie";
import { Array as Arr, Option, Record as Rec, Schema } from "effect";
import {
  getProMonthlyPricing,
  type PricingCurrency,
  PricingCurrencySchema,
} from "@/lib/pricing/monthly";

/** The cookie that keeps the price currency of a visitor, set from the request country. */
const PRICING_CURRENCY_COOKIE = "pricing_currency";

/** The attribute that the inline script sets on the root element before first paint. */
export const PRICING_CURRENCY_ATTRIBUTE = "data-currency";

/** The currency of a visitor who is in none of the mapped places. */
const FALLBACK_CURRENCY: PricingCurrency = "USD";

/** The Indonesian time zones, which show the rupiah price. */
const INDONESIAN_TIME_ZONES = [
  "Asia/Jakarta",
  "Asia/Jayapura",
  "Asia/Makassar",
  "Asia/Pontianak",
  "Asia/Ujung_Pandang",
];

/**
 * The European time zones of the territories that Polar prices in euros (see
 * `getProMonthlyPricing`), with the two Cyprus zones outside Europe. Other
 * zones, including those of the Atlantic and Africa, show the dollar price.
 */
const EURO_TIME_ZONES = [
  "Asia/Famagusta",
  "Asia/Nicosia",
  "Europe/Amsterdam",
  "Europe/Andorra",
  "Europe/Athens",
  "Europe/Berlin",
  "Europe/Bratislava",
  "Europe/Brussels",
  "Europe/Busingen",
  "Europe/Dublin",
  "Europe/Helsinki",
  "Europe/Ljubljana",
  "Europe/Lisbon",
  "Europe/Luxembourg",
  "Europe/Madrid",
  "Europe/Malta",
  "Europe/Mariehamn",
  "Europe/Monaco",
  "Europe/Nicosia",
  "Europe/Paris",
  "Europe/Podgorica",
  "Europe/Riga",
  "Europe/Rome",
  "Europe/San_Marino",
  "Europe/Tallinn",
  "Europe/Vatican",
  "Europe/Vienna",
  "Europe/Vilnius",
  "Europe/Zagreb",
];

/** Every mapped time zone and its currency. The inline script reads the same table. */
const TimeZoneCurrencies = Schema.Record(Schema.String, PricingCurrencySchema);

/** The mapping as JSON text, which the inline script reads. */
const TimeZoneCurrenciesJson = Schema.fromJsonString(TimeZoneCurrencies);

const CURRENCY_BY_TIME_ZONE: Readonly<Record<string, PricingCurrency>> =
  Rec.fromEntries([
    ...Arr.map(INDONESIAN_TIME_ZONES, (zone): [string, PricingCurrency] => [
      zone,
      "IDR",
    ]),
    ...Arr.map(EURO_TIME_ZONES, (zone): [string, PricingCurrency] => [
      zone,
      "EUR",
    ]),
  ]);

/** The currency of a request country, through the same mapping that the checkout uses. */
export function currencyForCountry(
  countryCode: string | null
): PricingCurrency {
  return getProMonthlyPricing(countryCode).currency;
}

/** The currency of a browser time zone, or the dollar price for a zone that is not mapped. */
export function currencyForTimeZone(timeZone: string): PricingCurrency {
  return Option.getOrElse(
    Rec.get(CURRENCY_BY_TIME_ZONE, timeZone),
    () => FALLBACK_CURRENCY
  );
}

/** The currency that a request's cookie chose, or none when the cookie is absent or unknown. */
export function readCurrencyCookie(
  headers: Headers
): Option.Option<PricingCurrency> {
  return readCookie(headers, PRICING_CURRENCY_COOKIE).pipe(
    Option.flatMap(Schema.decodeUnknownOption(PricingCurrencySchema))
  );
}

/**
 * The inline script that sets the price currency before the first paint, so the
 * page never shows a price that then changes. It reads the cookie first. Without
 * a known cookie it reads the browser time zone, and a zone that is not mapped
 * shows the dollar price. The mapping is written into the script, so the server
 * and the browser decide from one table.
 */
export function pricingCurrencyScript(): string {
  const zones = Schema.encodeSync(TimeZoneCurrenciesJson)(
    CURRENCY_BY_TIME_ZONE
  ).replace(/</gu, "\\u003c");
  const supported = Schema.encodeSync(
    Schema.fromJsonString(Schema.Array(PricingCurrencySchema))
  )(PricingCurrencySchema.literals);
  const cookiePrefix = `${PRICING_CURRENCY_COOKIE}=`;
  return Arr.join(
    [
      "(function () {",
      `  var zones = ${zones};`,
      `  var supported = ${supported};`,
      "  var currency = null;",
      "  var pairs = document.cookie.split(';');",
      "  for (var index = 0; index < pairs.length; index++) {",
      "    var pair = pairs[index].trim();",
      `    if (pair.indexOf('${cookiePrefix}') === 0) {`,
      `      currency = pair.slice('${cookiePrefix}'.length);`,
      "      break;",
      "    }",
      "  }",
      "  if (supported.indexOf(currency) === -1) {",
      "    var zone = '';",
      "    try {",
      "      zone = Intl.DateTimeFormat().resolvedOptions().timeZone || '';",
      "    } catch (error) {",
      "      zone = '';",
      "    }",
      `    currency = Object.prototype.hasOwnProperty.call(zones, zone) ? zones[zone] : '${FALLBACK_CURRENCY}';`,
      "  }",
      `  document.documentElement.setAttribute('${PRICING_CURRENCY_ATTRIBUTE}', currency);`,
      "})();",
    ],
    "\n"
  );
}
