import { Array as Arr, Option } from "effect";

/**
 * How often a list reads the clock again, which is the smallest unit an age is
 * written in, so no age changes between two readings.
 */
export const AGE_TICK_MILLISECONDS = 60_000;

/** The units an age is written in, from the largest that a row can show to the smallest. */
const AGE_UNITS: ReadonlyArray<readonly [Intl.RelativeTimeFormatUnit, number]> =
  [
    ["day", 86_400_000],
    ["hour", 3_600_000],
    ["minute", AGE_TICK_MILLISECONDS],
  ];

/**
 * Says how long ago a row of a profile was written, in the short words of the
 * locale, such as "2h ago", as every tab of the profile shows it. The largest
 * unit that fits is used, and a row less than a minute old says "now". A moment
 * in the future also says "now", because the clocks of two devices never agree
 * exactly.
 */
export function formatShortAge(createdAt: number, now: number, locale: string) {
  const format = new Intl.RelativeTimeFormat(locale, {
    numeric: "auto",
    style: "narrow",
  });
  const elapsed = now - createdAt;
  const unit = Arr.findFirst(AGE_UNITS, ([, size]) => elapsed >= size);
  return Option.match(unit, {
    onNone: () => format.format(0, "second"),
    onSome: ([name, size]) => format.format(-Math.floor(elapsed / size), name),
  });
}
