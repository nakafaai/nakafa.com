import { LOCALES, type Locale } from "@repo/internationalization/src/locale";
import { Array as Arr, Option, Record as Rec } from "effect";

/**
 * How often a list reads the clock again, which is the smallest unit an age is
 * written in, so no age changes between two readings.
 */
export const AGE_TICK_MILLISECONDS = 60_000;

/** The units an age is written in, from the largest that a row can show to the smallest. */
const AGE_UNITS: ReadonlyArray<readonly [Intl.RelativeTimeFormatUnit, number]> =
  [
    ["year", 31_536_000_000],
    ["month", 2_592_000_000],
    ["day", 86_400_000],
    ["hour", 3_600_000],
    ["minute", AGE_TICK_MILLISECONDS],
  ];

/** The format of a locale's ages in full words: counted units, or the word for the present moment. */
function relativeFormat(
  locale: Locale,
  numeric: Intl.RelativeTimeFormatNumeric
) {
  return new Intl.RelativeTimeFormat(locale, { numeric, style: "long" });
}

/** The two formats of every locale, built once. */
const FORMATS = Rec.fromEntries(
  Arr.map(LOCALES, (locale) => [
    locale,
    {
      counted: relativeFormat(locale, "always"),
      moment: relativeFormat(locale, "auto"),
    },
  ])
);

/**
 * Says how long ago a row was written in the locale's full words, such as "6 days ago" or "6 hari yang lalu", as
 * every tab of the profile, the comments, the notifications and the memory list show it. A narrow style writes a day
 * as "6 h lalu" in Indonesian, which reads as hours, and "auto" writes "selumbari" and "last mo.", so every unit is
 * spelled out and counted. The largest unit that fits is used, and a row less than a minute old says "now". A moment
 * in the future also says "now", because the clocks of two devices never agree exactly.
 */
export function formatAge(createdAt: number, now: number, locale: Locale) {
  const elapsed = now - createdAt;
  const unit = Arr.findFirst(AGE_UNITS, ([, size]) => elapsed >= size);
  const { counted, moment } = FORMATS[locale];
  return Option.match(unit, {
    onNone: () => moment.format(0, "second"),
    onSome: ([name, size]) => counted.format(-Math.floor(elapsed / size), name),
  });
}
