import {
  ACTIVE_APP_LOCALE_CODES,
  type ActiveAppLocaleCode,
} from "@nakafa/aksara-contracts/locale";
import { Schema } from "effect";
export const checkoutLocaleValidator = Schema.Literals([
  ...ACTIVE_APP_LOCALE_CODES,
]);

/**
 * Maps each Nakafa locale to a checkout language supported by Polar.
 *
 * German is supported directly. Indonesian is not supported yet, so it uses
 * Polar's documented English default without changing Nakafa's app locale.
 *
 * References:
 * - https://polar.sh/docs/features/checkout/localization
 * - https://polar.sh/docs/api-reference/checkouts/create-session
 */
export const polarCheckoutLocaleValidator = Schema.Literals(["de", "en"]);
export type PolarCheckoutLocale = Schema.Schema.Type<
  typeof polarCheckoutLocaleValidator
>;
const polarLocaleByAppLocale = {
  de: "de",
  en: "en",
  id: "en",
} satisfies Record<ActiveAppLocaleCode, PolarCheckoutLocale>;

/** Returns the supported Polar checkout language for one Nakafa locale. */
export function getPolarCheckoutLocale(locale: ActiveAppLocaleCode) {
  return polarLocaleByAppLocale[locale];
}
