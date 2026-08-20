import {
  ACTIVE_APP_LOCALE_CODES,
  type ActiveAppLocaleCode,
} from "@nakafa/aksara-contracts/locale";
import type { Locale } from "next-intl";
import { hasLocale } from "next-intl";

/** Narrows one route locale to the currently signed production locale set. */
export function isActiveLocale(locale: Locale): locale is ActiveAppLocaleCode {
  return hasLocale(ACTIVE_APP_LOCALE_CODES, locale);
}
