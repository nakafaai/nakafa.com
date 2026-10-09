import { DateTime } from "effect";

/** Chart month labels are English, whatever the viewer's locale. */
const CHART_MONTH_LOCALE = "en-US";

/**
 * Formats a chart date key such as 2021-01-01 as its short month and year,
 * for example Jan 2021. The key names a calendar month, so UTC is the zone to
 * read it in: local time shows the previous month for viewers west of UTC.
 */
export function formatShortMonthYear(date: string) {
  return DateTime.formatUtc(DateTime.makeUnsafe(date), {
    locale: CHART_MONTH_LOCALE,
    month: "short",
    year: "numeric",
  });
}

/** Formats a chart date key as its long month and year, for example January 2021. */
export function formatLongMonthYear(date: string) {
  return DateTime.formatUtc(DateTime.makeUnsafe(date), {
    locale: CHART_MONTH_LOCALE,
    month: "long",
    year: "numeric",
  });
}
