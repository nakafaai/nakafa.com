import { enUS, id } from "date-fns/locale";
/** Map the active app locale to a date-fns locale object. */
export function getLocale(locale?: string | null) {
  if (locale === "id") {
    return id;
  }

  return enUS;
}
