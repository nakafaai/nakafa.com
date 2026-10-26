import {
  countryDefaults,
  StartCountry,
} from "@repo/backend/confect/tenancy/start";
import { DateTime, Duration, Schema } from "effect";

/** Every School offer: a month or a year of Polar seats, or a semester or school year paid by invoice. */
export const SchoolOffer = Schema.Literals([
  "school.seat.month",
  "school.seat.semester",
  "school.seat.year",
]);

/** The offers a school pays by invoice: one semester, or one school year, paid at once. */
export const TermOffer = Schema.Literals([
  "school.seat.semester",
  "school.seat.year",
]);
export type TermOffer = typeof TermOffer.Type;

/** The months each invoice offer covers. */
const TERM_MONTHS = {
  "school.seat.semester": 6,
  "school.seat.year": 12,
} as const satisfies Record<TermOffer, number>;

/** The school year of a country without a school profile: the calendar year, read in UTC. */
const CALENDAR_YEAR = { yearStart: 1, zone: "UTC" } as const;

const isStartCountry = Schema.is(StartCountry);

/** The month a country's school year starts in, and the zone its days are read in. */
function schoolYearOf(country: string) {
  if (!isStartCountry(country)) {
    return CALENDAR_YEAR;
  }
  const profile = countryDefaults[country];
  return { yearStart: profile.yearStart, zone: profile.zones[0] };
}

/**
 * The semester or the school year that holds `now` in one country. A term starts
 * at midnight on the first day of its month in the country's first time zone; the
 * school year starts in the country's `yearStart` month, and its second semester
 * six months later.
 */
export function termOf(offer: TermOffer, country: string, now: number) {
  const { yearStart, zone } = schoolYearOf(country);
  const local = DateTime.makeZonedUnsafe(now, { timeZone: zone });
  const month = DateTime.getPart(local, "month");
  const months = TERM_MONTHS[offer];
  const intoYear = (month - yearStart + 12) % 12;
  const yearStartDay = DateTime.makeZonedUnsafe(
    {
      year: DateTime.getPart(local, "year") - (month < yearStart ? 1 : 0),
      month: yearStart,
      day: 1,
    },
    { adjustForTimeZone: true, timeZone: zone }
  );
  const start = DateTime.add(yearStartDay, {
    months: intoYear - (intoYear % months),
  });
  return {
    start: DateTime.toEpochMillis(start),
    end: DateTime.toEpochMillis(DateTime.add(start, { months })),
  };
}

const DAY_MS = Duration.toMillis(Duration.days(1));

/**
 * The price of one seat billed from `from` to the end of a term (K45): the share
 * of the term's days still to run, in whole minor units, rounded up. A seat billed
 * from the start of the term pays the whole price.
 */
export function proratedPrice(
  price: number,
  term: { readonly start: number; readonly end: number },
  from: number
) {
  const days = Math.ceil((term.end - term.start) / DAY_MS);
  const left = Math.ceil((term.end - Math.max(from, term.start)) / DAY_MS);
  return Math.ceil((price * left) / days);
}
