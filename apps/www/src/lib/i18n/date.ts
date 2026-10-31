import type { ActiveAppLocaleCode } from "@nakafa/aksara-contracts/locale";
import { decodeLocale } from "@repo/internationalization/src/locale";
import { DateTime, Option } from "effect";

// Dates of content and of the viewer. School times are not written here: they
// go through `formatSchoolTime` in `@repo/internationalization/src/school/time`,
// which reads the school's own time zone instead of the viewer's.

/**
 * The short month of a day of publication. The language and the zone never
 * change, so one formatter serves every card.
 */
const PUBLISHED_MONTH = new Intl.DateTimeFormat("en-US", {
  month: "short",
  timeZone: "UTC",
});

/**
 * What one language needs to write a moment beyond what `Intl` knows: the
 * `separator` between its day and its time. The formatters are built once,
 * because building one costs far more than using it and a list writes one moment
 * per row. The day and the time come from `Intl` apart, because the languages
 * differ in what stands between them. Both read the time zone of the viewer when
 * they are built.
 */
function language(code: ActiveAppLocaleCode, separator: string) {
  return {
    day: new Intl.DateTimeFormat(code, {
      day: "numeric",
      month: "short",
      year: "numeric",
    }),
    separator,
    time: new Intl.DateTimeFormat(code, { timeStyle: "short" }),
  };
}

/**
 * The words of every active locale. A new active locale fails the type check
 * here until it gets its words.
 */
const LANGUAGES = {
  de: language("de", " "),
  en: language("en", ", "),
  id: language("id", ", "),
} satisfies Record<ActiveAppLocaleCode, ReturnType<typeof language>>;

/** The locale that dates are written in: an active app locale, else English. */
function dateLocale(locale?: string | null): ActiveAppLocaleCode {
  return Option.getOrElse(decodeLocale(locale), () => "en");
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
