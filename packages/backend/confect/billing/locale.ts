import {
  ACTIVE_APP_LOCALE_CODES,
  type ActiveAppLocaleCode,
  type AppLocaleCode,
} from "@nakafa/aksara-contracts/locale";
import { Schema } from "effect";

export const checkoutLocaleValidator = Schema.Literals([
  ...ACTIVE_APP_LOCALE_CODES,
]);

/**
 * Maps each Nakafa locale to a checkout language supported by Polar.
 *
 * German is supported directly. Indonesian and Malay are not supported yet, so
 * they use Polar's documented English default without changing Nakafa's app
 * locale.
 *
 * References:
 * - https://polar.sh/docs/features/checkout/localization
 * - https://polar.sh/docs/api-reference/checkouts/create-session
 */
export const polarCheckoutLocaleValidator = Schema.Literals(["de", "en"]);
type PolarCheckoutLocale = typeof polarCheckoutLocaleValidator.Type;

const polarLocaleByAppLocale = {
  de: "de",
  en: "en",
  id: "en",
  ms: "en",
} satisfies Record<AppLocaleCode, PolarCheckoutLocale>;

/** Returns the supported Polar checkout language for one Nakafa locale. */
export function getPolarCheckoutLocale(locale: ActiveAppLocaleCode) {
  return polarLocaleByAppLocale[locale];
}

/**
 * Maps each Nakafa locale to a language of Xendit's hosted checkout, which
 * speaks Indonesian and English. German and Malay readers get English.
 */
export const xenditCheckoutLocaleValidator = Schema.Literals(["en", "id"]);
type XenditCheckoutLocale = typeof xenditCheckoutLocaleValidator.Type;

const xenditLocaleByAppLocale = {
  de: "en",
  en: "en",
  id: "id",
  ms: "en",
} satisfies Record<AppLocaleCode, XenditCheckoutLocale>;

/** Returns the language of Xendit's hosted checkout for one Nakafa locale. */
export function getXenditCheckoutLocale(locale: ActiveAppLocaleCode) {
  return xenditLocaleByAppLocale[locale];
}
