import { Array as Arr } from "effect";

const SECONDS_PER_MINUTE = 60;
const SECONDS_PER_HOUR = 3600;
const LAST_MINUTE = 60;
const LAST_FIVE_MINUTES = 300;

/** Splits seconds into whole hours, whole minutes, and the seconds that remain. */
export function splitTime(totalSeconds: number) {
  return {
    hours: Math.floor(totalSeconds / SECONDS_PER_HOUR),
    minutes: Math.floor((totalSeconds % SECONDS_PER_HOUR) / SECONDS_PER_MINUTE),
    seconds: totalSeconds % SECONDS_PER_MINUTE,
  };
}

/** Formats a duration in seconds as a zero-padded clock string, such as `00:30:00`. */
export function formatClock(totalSeconds: number) {
  const { hours, minutes, seconds } = splitTime(totalSeconds);
  return Arr.join(
    Arr.map([hours, minutes, seconds], (part) => String(part).padStart(2, "0")),
    ":"
  );
}

/**
 * Which warning a screen reader hears for the time left: once when five
 * minutes remain, once when one minute remains, and none before that or once
 * the time is up.
 */
export function readTimeNotice(totalSeconds: number) {
  if (totalSeconds <= 0) {
    return "none";
  }
  if (totalSeconds <= LAST_MINUTE) {
    return "one";
  }
  return totalSeconds <= LAST_FIVE_MINUTES ? "five" : "none";
}
