import { Array as Arr } from "effect";

/** The units an attempt's deadline reads in, largest first. */
const DAY = 86_400;
const HOUR = 3600;
const MINUTE = 60;

/**
 * The parts a deadline reads in: days, hours and minutes while a day or more is left, so a set window
 * of three days never reads as 69 hours, and hours, minutes and seconds in its last day.
 */
export function readDeadlineParts(seconds: number) {
  const left = Math.max(0, seconds);
  if (left >= DAY) {
    return Arr.make(
      { unit: "days", value: Math.floor(left / DAY) } as const,
      { unit: "hours", value: Math.floor((left % DAY) / HOUR) } as const,
      { unit: "minutes", value: Math.floor((left % HOUR) / MINUTE) } as const
    );
  }
  return Arr.make(
    { unit: "hours", value: Math.floor(left / HOUR) } as const,
    { unit: "minutes", value: Math.floor((left % HOUR) / MINUTE) } as const,
    { unit: "seconds", value: left % MINUTE } as const
  );
}
