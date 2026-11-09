import {
  ACTIVE_APP_LOCALE_CODES,
  ActiveAppLocaleCodeSchema,
} from "@nakafa/aksara-contracts/locale";
import {
  type Locale,
  localeTimeZone,
} from "@repo/internationalization/src/locale";
import { namedTimeZone } from "@repo/utilities/timezone";
import {
  Array as Arr,
  DateTime,
  Effect,
  Option,
  Record as Rec,
  Schema,
  String as Str,
} from "effect";
import { createFormatter, type Formats } from "use-intl/core";

/**
 * The zone that billing days are read in, the zone of Nakafa's Indonesian
 * billing, so the server and every viewer write the same day. A credit reset at
 * 00:00 UTC falls at 07:00 on the same day in Jakarta.
 */
export const BILLING_TIME_ZONE = "Asia/Jakarta";

/**
 * Every way Nakafa writes a moment, a number or a list, by name. React reads
 * them through `useFormatter` (the locale providers pass `FORMATS`), other code
 * through `formatterOf`, and both write one shape the same on every page. A
 * format with a zone writes a day that no viewer's zone may move: a calendar day
 * kept as UTC midnight, or a billing day.
 */
export const FORMATS = {
  dateTime: {
    /** A day: Oct 6, 2026. */
    date: { dateStyle: "medium" },
    /** A day and its time: Oct 6, 2026, 3:30 PM. */
    dateTime: { dateStyle: "medium", timeStyle: "short" },
    /** A time of day: 3:30 PM. */
    time: { timeStyle: "short" },
    /** A day of the next weeks, without its year: Oct 6. */
    day: { day: "numeric", month: "short" },
    /** A moment of the next weeks, without its year: Oct 6, 03:30 PM. */
    dayTime: {
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      month: "short",
    },
    /** A day in full words: October 6, 2026. */
    long: { dateStyle: "long" },
    /** A month's name: October. */
    month: { month: "long" },
    /** A time of day kept as UTC, such as a time a picker offers: 03:30 PM. */
    clock: { hour: "2-digit", minute: "2-digit", timeZone: "UTC" },
    /** A moment with its weekday: Tuesday, October 6, 2026 at 3:30 PM. */
    full: { dateStyle: "full", timeStyle: "short" },
    /** A calendar day kept as UTC midnight, such as a publication day: Oct 6, 2026. */
    calendar: { dateStyle: "medium", timeZone: "UTC" },
    /** The same calendar day in full words: October 6, 2026. */
    calendarLong: { dateStyle: "long", timeZone: "UTC" },
    /** A billing day in full words: October 6, 2026. */
    billing: { dateStyle: "long", timeZone: BILLING_TIME_ZONE },
    /** A billing day for a narrow column: Oct 6, 2026. */
    billingDay: { dateStyle: "medium", timeZone: BILLING_TIME_ZONE },
  },
  number: {
    /** A value in a lesson's math, with at most two decimals and no grouping: 1234.5. */
    math: { maximumFractionDigits: 2, useGrouping: false },
    /** A trigonometric value with exactly two decimals: 0.71. */
    trig: {
      maximumFractionDigits: 2,
      minimumFractionDigits: 2,
      useGrouping: false,
    },
    /** A score or a grade average with exactly two decimals: 87.50. */
    score: { maximumFractionDigits: 2, minimumFractionDigits: 2 },
    /** A grade with at most two decimals: 67.5. */
    grade: { maximumFractionDigits: 2 },
    /** A computed value kept to ten significant digits, so float noise never shows. */
    precise: { maximumSignificantDigits: 10 },
    /** A whole count without grouping: 2026. */
    plain: { useGrouping: false },
    /** A coefficient in a formula, in full and without grouping: 0.1 or 1000000. */
    coefficient: { maximumSignificantDigits: 21, useGrouping: false },
    /** An amount in a currency, which the call names with its digits. */
    currency: { style: "currency" },
    /** A size in kilobytes, megabytes, gigabytes or terabytes; `formatBytes` picks one. */
    kilobyte: { maximumFractionDigits: 0, style: "unit", unit: "kilobyte" },
    megabyte: { maximumFractionDigits: 1, style: "unit", unit: "megabyte" },
    gigabyte: { maximumFractionDigits: 1, style: "unit", unit: "gigabyte" },
    terabyte: { maximumFractionDigits: 1, style: "unit", unit: "terabyte" },
  },
  list: {
    /** Every item: a, b and c. */
    and: { type: "conjunction" },
    /** Any one item: a, b or c. */
    or: { type: "disjunction" },
  },
} as const satisfies Formats;

/** The formatter of every public locale in its own time zone, built once. */
const FORMATTERS = Rec.fromEntries(
  Arr.map(ACTIVE_APP_LOCALE_CODES, (locale) => [
    locale,
    createFormatter({
      formats: FORMATS,
      locale,
      timeZone: localeTimeZone(locale),
    }),
  ])
);

/**
 * The formatter of one locale for code that renders outside a locale provider:
 * server modules, metadata, emails, documents. It writes `FORMATS` as
 * `useFormatter` does, caches every platform formatter it builds, and reads the
 * locale's time zone unless a call names another one.
 */
export function formatterOf(locale: Locale) {
  return FORMATTERS[locale];
}

/** The size of each unit an age is written in, from the largest to the smallest. */
const AGE_UNITS = [
  ["year", 31_536_000_000],
  ["month", 2_628_000_000],
  ["day", 86_400_000],
  ["hour", 3_600_000],
  ["minute", 60_000],
] as const;

/**
 * How often a list reads the clock again, which is the smallest unit an age is
 * written in, so no age changes between two readings.
 */
export const AGE_TICK_MILLISECONDS = 60_000;

/**
 * Says how long ago a row was written in the locale's full words, such as "6
 * days ago" or "6 hari yang lalu". The largest unit that fits is counted down to
 * a whole number, so a day and a half reads "1 day ago", and every unit is
 * spelled out: never "6 h lalu", which reads as hours, nor "selumbari". A row
 * less than a minute old, or one from a clock ahead of this one, says "now".
 */
export function formatAge(createdAt: number, now: number, locale: Locale) {
  const elapsed = now - createdAt;
  const formatter = formatterOf(locale);
  return Option.match(
    Arr.findFirst(AGE_UNITS, ([, size]) => elapsed >= size),
    {
      onNone: () => formatter.relativeTime(now, { now, unit: "second" }),
      onSome: ([unit, size]) =>
        formatter.relativeTime(now - Math.floor(elapsed / size) * size, {
          now,
          unit,
        }),
    }
  );
}

/** The units a size is written in, each 1,000 times the one before, from the largest. */
const BYTE_UNITS = [
  ["terabyte", 1_000_000_000_000],
  ["gigabyte", 1_000_000_000],
  ["megabyte", 1_000_000],
] as const;

/**
 * A size in bytes, in the largest unit it fills and the reader's digits: 500 kB,
 * 10.2 GB, 1 TB. The number and the unit never part across a line.
 */
export function formatBytes(bytes: number, locale: Locale) {
  const [unit, size] = Option.getOrElse(
    Arr.findFirst(BYTE_UNITS, ([, step]) => bytes >= step),
    () => ["kilobyte", 1000] as const
  );
  return Str.replaceAll(
    " ",
    "\u00a0"
  )(formatterOf(locale).number(bytes / size, unit));
}

/**
 * The shapes in which a class writes a school's time: a date, a time, a date
 * and a time, a relative day, which reads `today` or `yesterday` and falls back
 * to the date on any other day, or a day and month with a time, which names a
 * moment of the next weeks without its year.
 */
export const SchoolTimeFormat = Schema.Literals([
  "date",
  "dateTime",
  "relativeDay",
  "time",
  "dayTime",
]);

export type SchoolTimeFormat = typeof SchoolTimeFormat.Type;

/**
 * What a school time is written from: the instant, the school's time zone as an
 * IANA name, the interface locale, and the current instant. The caller reads
 * `now` through `Clock`, and only a relative day uses it.
 */
const SchoolTimeRequest = Schema.Struct({
  format: SchoolTimeFormat,
  instant: Schema.DateTimeUtc,
  locale: ActiveAppLocaleCodeSchema,
  now: Schema.DateTimeUtc,
  timeZone: Schema.String,
});

type SchoolTimeRequest = typeof SchoolTimeRequest.Type;

/**
 * A school's time zone is not an IANA name that the platform knows, or it is a
 * fixed offset such as `+07:00`, which is not an IANA name.
 */
export class SchoolTimeZoneError extends Schema.TaggedError<
  SchoolTimeZoneError,
  { readonly brand: unique symbol }
>()("SchoolTimeZoneError", { timeZone: Schema.String }) {}

/**
 * Writes one instant in the time zone of a school and in the locale of the
 * reader, in one of the shapes of `SchoolTimeFormat`. The dates and times are
 * the school's own, so the same instant can fall on different days in two
 * schools. The clock is never read here.
 */
export const formatSchoolTime = Effect.fn(
  "internationalization.formats.schoolTime"
)(function* (request: SchoolTimeRequest) {
  const zone = yield* Effect.fromOption(namedTimeZone(request.timeZone)).pipe(
    Effect.mapError(
      () => new SchoolTimeZoneError({ timeZone: request.timeZone })
    )
  );
  const date = formatterOf(request.locale).dateTime(
    DateTime.toEpochMillis(request.instant),
    request.format === "relativeDay" ? "date" : request.format,
    { timeZone: DateTime.zoneToString(zone) }
  );

  if (request.format !== "relativeDay") {
    return date;
  }

  return Option.getOrElse(relativeDay(request, zone), () => date);
});

/**
 * Names the day of the instant `today` or `yesterday` when it falls on the
 * school's current day or on the day before it, in the words of the locale. Any
 * other day has no word. Both days are read on the school's own calendar.
 */
function relativeDay(
  request: SchoolTimeRequest,
  zone: DateTime.TimeZone.Named
) {
  const day = DateTime.formatIsoDate(DateTime.setZone(request.instant, zone));
  const today = DateTime.setZone(request.now, zone);
  const words = new Intl.RelativeTimeFormat(request.locale, {
    numeric: "auto",
  });

  if (day === DateTime.formatIsoDate(today)) {
    return Option.some(words.format(0, "day"));
  }
  if (day === DateTime.formatIsoDate(DateTime.subtract(today, { days: 1 }))) {
    return Option.some(words.format(-1, "day"));
  }
  return Option.none();
}
