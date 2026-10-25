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
