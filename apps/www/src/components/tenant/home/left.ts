import { Duration } from "effect";

/** One minute, in milliseconds. */
const MINUTE_MS = Duration.toMillis(Duration.minutes(1));

/**
 * The minutes a room has left before it closes, counted up, so a room with seconds left reads as one
 * minute. A room that has closed has none left.
 */
export const minutesLeft = (closesAt: number, now: number) =>
  Math.max(0, Math.ceil((closesAt - now) / MINUTE_MS));
