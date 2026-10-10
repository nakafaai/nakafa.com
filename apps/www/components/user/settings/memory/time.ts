import { formatDistance } from "date-fns";
import { getLocale } from "@/lib/i18n/date";

/**
 * Says how long ago a memory was confirmed, in the learner's language, such as
 * "3 days ago". A confirmation the server stamped after `now` reads as just
 * now, because the learner's clock can run behind the server's.
 */
export function formatConfirmed(
  confirmedAt: number,
  now: number,
  locale: string
) {
  return formatDistance(Math.min(confirmedAt, now), now, {
    addSuffix: true,
    locale: getLocale(locale),
  });
}

/**
 * Says on which day a situation ends, such as "October 20, 2026". The server
 * stores the end of the day the learner named in UTC, so the day is read in
 * UTC too: in any other zone it could land on the day before or after.
 */
export function formatEnds(validUntil: number, locale: string) {
  return new Intl.DateTimeFormat(locale, {
    dateStyle: "long",
    timeZone: "UTC",
  }).format(validUntil);
}
