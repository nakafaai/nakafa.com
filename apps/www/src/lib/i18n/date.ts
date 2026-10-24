import { type ActiveAppLocaleCode } from "@nakafa/aksara-contracts/locale";
import { decodeLocale } from "@repo/internationalization/src/locale";
import { Array as Arr, DateTime, Duration, Option } from "effect";

// Dates of content and of the viewer. School times are not written here: they
// go through `formatSchoolTime` in `@repo/internationalization/src/school/time`,
// which reads the school's own time zone instead of the viewer's.

const MINUTES_IN_HOUR = Duration.toMinutes(Duration.hours(1));
const MINUTES_IN_DAY = Duration.toMinutes(Duration.days(1));
const MINUTES_IN_MONTH = Duration.toMinutes(Duration.days(30));
const MONTHS_IN_YEAR = 12;
/**
 * Where each wording of an age ends, in minutes: minutes up to three quarters
 * of an hour, about one hour up to an hour and a half, hours up to a day, one
 * day up to a day and three quarters, days up to 30 days, and about so many
 * months up to two months.
 */
const AGE_LIMITS = {
  minutes: Duration.toMinutes(Duration.minutes(45)),
  oneHour: Duration.toMinutes(Duration.hours(1.5)),
  hours: MINUTES_IN_DAY,
  oneDay: Duration.toMinutes(Duration.hours(42)),
  days: MINUTES_IN_MONTH,
  aboutMonths: Duration.toMinutes(Duration.days(60)),
};
/**
 * The months past a whole year below which an age reads as about that year,
 * and below which it reads as over it. From there it reads as almost the next.
 */
const MONTHS_BEFORE_OVER = 3;
const MONTHS_BEFORE_ALMOST = 9;
/**
 * The short month of a day of publication. The language and the zone never
 * change, so one formatter serves every card.
 */
const PUBLISHED_MONTH = new Intl.DateTimeFormat("en-US", {
  month: "short",
  timeZone: "UTC",
});

/**
 * What one language needs to write an age and a moment beyond what `Intl`
 * knows. `about`, `over`, and `almost` go before a number that is not exact,
 * `lessThanMinute` is the whole phrase for an age under half a minute, and
 * `separator` goes between the day and the time of a moment. The formatters
 * are built once, because building one costs far more than using it and a list
 * writes one age or moment per row. The day and the time come from `Intl`
 * apart, because the languages differ in what stands between them. The two of
 * a moment read the time zone of the viewer when they are built.
 */
function language(
  code: ActiveAppLocaleCode,
  words: Record<
    "about" | "almost" | "lessThanMinute" | "over" | "separator",
    string
  >
) {
  return {
    ...words,
    day: new Intl.DateTimeFormat(code, {
      day: "numeric",
      month: "short",
      year: "numeric",
    }),
    relative: new Intl.RelativeTimeFormat(code),
    time: new Intl.DateTimeFormat(code, { timeStyle: "short" }),
  };
}

/**
 * The words of every active locale. A new active locale fails the type check
 * here until it gets its words.
 */
const LANGUAGES = {
  de: language("de", {
    about: "etwa",
    almost: "fast",
    lessThanMinute: "vor weniger als 1 Minute",
    over: "mehr als",
    separator: " ",
  }),
  en: language("en", {
    about: "about",
    almost: "almost",
    lessThanMinute: "less than a minute ago",
    over: "over",
    separator: ", ",
  }),
  id: language("id", {
    about: "sekitar",
    almost: "hampir",
    lessThanMinute: "kurang dari 1 menit yang lalu",
    over: "lebih dari",
    separator: ", ",
  }),
} satisfies Record<ActiveAppLocaleCode, ReturnType<typeof language>>;

/** The locale that dates are written in: an active app locale, else English. */
function dateLocale(locale?: string | null): ActiveAppLocaleCode {
  return Option.getOrElse(decodeLocale(locale), () => "en");
}

/**
 * Writes `count` of a unit before now, such as "3 hours ago". A number that is
 * not exact gets a hedge before it, such as "about 3 hours ago" and "vor etwa 3
 * Stunden". `Intl.RelativeTimeFormat` has no hedge, and in every language it
 * writes the number first and the unit after it, so the hedge goes right before
 * the number.
 */
function writeAge(
  relative: Intl.RelativeTimeFormat,
  count: number,
  unit: Intl.RelativeTimeFormatUnit,
  hedge?: string
) {
  if (hedge === undefined) {
    return relative.format(-count, unit);
  }
  return Arr.join(
    Arr.map(relative.formatToParts(-count, unit), (part) =>
      part.type === "integer" ? `${hedge} ${part.value}` : part.value
    ),
    ""
  );
}

/** How far into its calendar month, in UTC, a moment is. */
function intoMonth(moment: DateTime.Utc) {
  return DateTime.distance(DateTime.startOf(moment, "month"), moment);
}

/**
 * Counts the whole calendar months from one moment to a later one, in UTC. The
 * last month is whole once the later moment is as far into its month as the
 * earlier one is into its own.
 */
function wholeMonths(from: number, to: number) {
  const start = DateTime.makeUnsafe(from);
  const end = DateTime.makeUnsafe(to);
  const months =
    (DateTime.getPartUtc(end, "year") - DateTime.getPartUtc(start, "year")) *
      MONTHS_IN_YEAR +
    DateTime.getPartUtc(end, "month") -
    DateTime.getPartUtc(start, "month");

  return Duration.isLessThan(intoMonth(end), intoMonth(start))
    ? months - 1
    : months;
}

/**
 * Says how long ago a moment was, in the words of the locale, such as "about 3
 * hours ago". The words are the ones date-fns wrote, hedges included, and so
 * are the lines between them: an age rounds to the nearest minute, reads in
 * minutes, hours, days, and months by the limits above, and in years by the
 * whole calendar months it spans, so that 15 months read as "over 1 year" and
 * 21 months as "almost 2 years". The months are counted in UTC and the time is
 * the time that passed, so neither a time zone nor a change of the clocks moves
 * an age. A moment after `now` reads as an age under a minute, because the
 * clock of a browser can run behind the server's. `now` is the current time
 * unless a caller names the moment to count from.
 */
export function formatAge(
  timestamp: number,
  locale?: string | null,
  now = DateTime.toEpochMillis(DateTime.nowUnsafe())
) {
  const { about, almost, lessThanMinute, over, relative } =
    LANGUAGES[dateLocale(locale)];
  const minutes = Math.round(
    Duration.toMinutes(Duration.millis(Math.max(now - timestamp, 0)))
  );
  if (minutes < 1) {
    return lessThanMinute;
  }
  if (minutes < AGE_LIMITS.minutes) {
    return writeAge(relative, minutes, "minute");
  }
  if (minutes < AGE_LIMITS.oneHour) {
    return writeAge(relative, 1, "hour", about);
  }
  if (minutes < AGE_LIMITS.hours) {
    return writeAge(
      relative,
      Math.round(minutes / MINUTES_IN_HOUR),
      "hour",
      about
    );
  }
  if (minutes < AGE_LIMITS.oneDay) {
    return writeAge(relative, 1, "day");
  }
  if (minutes < AGE_LIMITS.days) {
    return writeAge(relative, Math.round(minutes / MINUTES_IN_DAY), "day");
  }
  const months = Math.round(minutes / MINUTES_IN_MONTH);
  if (minutes < AGE_LIMITS.aboutMonths) {
    return writeAge(relative, months, "month", about);
  }
  const calendarMonths = wholeMonths(timestamp, now);
  if (calendarMonths < MONTHS_IN_YEAR) {
    return writeAge(relative, months, "month");
  }
  const years = Math.trunc(calendarMonths / MONTHS_IN_YEAR);
  const monthsPastYear = calendarMonths % MONTHS_IN_YEAR;
  if (monthsPastYear < MONTHS_BEFORE_OVER) {
    return writeAge(relative, years, "year", about);
  }
  if (monthsPastYear < MONTHS_BEFORE_ALMOST) {
    return writeAge(relative, years, "year", over);
  }
  return writeAge(relative, years + 1, "year", almost);
}

/**
 * Says when a moment was, in the order and words of the locale and in the time
 * zone of the viewer, such as "Oct 6, 2026, 3:30 PM".
 */
export function formatMoment(timestamp: number, locale?: string | null) {
  const { day, separator, time } = LANGUAGES[dateLocale(locale)];

  return `${day.format(timestamp)}${separator}${time.format(timestamp)}`;
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
