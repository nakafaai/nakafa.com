import {
  ACTIVE_APP_LOCALE_CODES,
  type ActiveAppLocaleCode,
} from "@nakafa/aksara-contracts/locale";
import { DateTime, Duration } from "effect";
import { hasLocale } from "next-intl";

const MINUTES_IN_HOUR = Duration.toMinutes(Duration.hours(1));
const MINUTES_IN_DAY = Duration.toMinutes(Duration.days(1));
const MINUTES_IN_MONTH = Duration.toMinutes(Duration.days(30));
const MINUTES_IN_YEAR = Duration.toMinutes(Duration.days(365));
/** An age counts in hours from three quarters of an hour. */
const MINUTES_BEFORE_HOURS = 45;
/**
 * The short month of a day of publication. The language and the zone never
 * change, so one formatter serves every card.
 */
const PUBLISHED_MONTH = new Intl.DateTimeFormat("en-US", {
  month: "short",
  timeZone: "UTC",
});

/**
 * The relative-time formatters of one locale: `always` writes a number, and
 * `auto` writes a word such as "now" where the language has one.
 */
function ageFormatters(locale: ActiveAppLocaleCode) {
  return {
    always: new Intl.RelativeTimeFormat(locale),
    auto: new Intl.RelativeTimeFormat(locale, { numeric: "auto" }),
  };
}

/**
 * The age formatters of every active locale. Building a formatter costs far
 * more than using one, and a list writes one age per row, so they are built
 * once. A new active locale fails the type check here until it gets its
 * formatters.
 */
const AGE_FORMATTERS = {
  de: ageFormatters("de"),
  en: ageFormatters("en"),
  id: ageFormatters("id"),
} satisfies Record<ActiveAppLocaleCode, ReturnType<typeof ageFormatters>>;

/** The locale that dates are written in: an active app locale, else English. */
function dateLocale(locale?: string | null) {
  return hasLocale(ACTIVE_APP_LOCALE_CODES, locale) ? locale : "en";
}

/**
 * Says how long ago a moment was, in the words of the locale, such as "3 days
 * ago". An age rounds to the nearest whole minute, hour, day, 30-day month, or
 * 365-day year, and an age under half a minute reads as "now". A moment after
 * `now` reads as now too, because the clock of a browser can run behind the
 * server's. `now` is the current time unless a caller names the moment to
 * count from.
 */
export function formatAge(
  timestamp: number,
  locale?: string | null,
  now = DateTime.toEpochMillis(DateTime.nowUnsafe())
) {
  const { always, auto } = AGE_FORMATTERS[dateLocale(locale)];
  const minutes = Math.round(
    Duration.toMinutes(Duration.millis(now - timestamp))
  );
  if (minutes < 1) {
    return auto.format(0, "second");
  }
  if (minutes < MINUTES_BEFORE_HOURS) {
    return always.format(-minutes, "minute");
  }
  if (minutes < MINUTES_IN_DAY) {
    return always.format(-Math.round(minutes / MINUTES_IN_HOUR), "hour");
  }
  if (minutes < MINUTES_IN_MONTH) {
    return always.format(-Math.round(minutes / MINUTES_IN_DAY), "day");
  }
  if (minutes < MINUTES_IN_YEAR) {
    return always.format(-Math.round(minutes / MINUTES_IN_MONTH), "month");
  }
  return always.format(-Math.round(minutes / MINUTES_IN_YEAR), "year");
}

/**
 * Says when a moment was, in the order and words of the locale and in the time
 * zone of the viewer, such as "Oct 6, 2026, 3:30 PM".
 */
export function formatMoment(timestamp: number, locale?: string | null) {
  return new Intl.DateTimeFormat(dateLocale(locale), {
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    month: "short",
    year: "numeric",
  }).format(timestamp);
}

/**
 * Says on which day an article was published, such as "6 Oct, 2026". The cards
 * have always written this day in English, whatever the locale. It is a
 * calendar day with no time zone, so it is read in UTC and is the same for
 * every viewer.
 */
export function formatPublished(date: string) {
  const published = DateTime.makeUnsafe(`${date}T00:00:00.000Z`);
  const month = PUBLISHED_MONTH.format(DateTime.toEpochMillis(published));

  return `${DateTime.getPartUtc(published, "day")} ${month}, ${DateTime.getPartUtc(published, "year")}`;
}
