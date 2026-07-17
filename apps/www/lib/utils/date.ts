import { type Locale as AppLocale, locales } from "@repo/utilities/locales";
import type { Locale as DateFnsLocale } from "date-fns";
import { enUS, id } from "date-fns/locale";
import { hasLocale } from "next-intl";

const dateLocales: Record<AppLocale, DateFnsLocale> = {
  en: enUS,
  id,
};

/** Map the active app locale to a date-fns locale object. */
export function getLocale(locale?: string | null) {
  if (!hasLocale(locales, locale)) {
    return enUS;
  }

  return dateLocales[locale];
}
