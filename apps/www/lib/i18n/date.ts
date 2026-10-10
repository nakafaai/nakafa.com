import {
  ACTIVE_APP_LOCALE_CODES,
  type ActiveAppLocaleCode as AppLocale,
} from "@nakafa/aksara-contracts/locale";
import type { Locale as DateFnsLocale } from "date-fns";
import { de, enUS, id } from "date-fns/locale";
import { hasLocale } from "next-intl";

const dateLocales: Record<AppLocale, DateFnsLocale> = {
  de,
  en: enUS,
  id,
};

/** Map the active app locale to a date-fns locale object. */
export function getLocale(locale?: string | null) {
  if (!hasLocale(ACTIVE_APP_LOCALE_CODES, locale)) {
    return enUS;
  }

  return dateLocales[locale];
}
