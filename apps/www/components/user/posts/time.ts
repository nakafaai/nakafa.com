import { Array as Arr, Option } from "effect";

/** The units a post's age is written in, from the largest that a post can show to the smallest. */
const AGE_UNITS: ReadonlyArray<readonly [Intl.RelativeTimeFormatUnit, number]> =
  [
    ["day", 86_400_000],
    ["hour", 3_600_000],
    ["minute", 60_000],
  ];

/**
 * Says how long ago a post was written in the words of the locale, such as "2h
 * ago". The largest unit that fits is used, and a post less than a minute old
 * says "now". A moment in the future also says "now", because the clocks of two
 * devices never agree exactly.
 */
export function formatPostAge(createdAt: number, now: number, locale: string) {
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
