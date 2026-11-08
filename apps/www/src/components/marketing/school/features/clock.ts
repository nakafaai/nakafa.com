import { DateTime } from "effect";

/** The moment the demos of the School landing happen at, so every time they show is the same on the server and in the browser. */
const DEMO_MOMENT = DateTime.makeUnsafe("2026-11-06T10:02:00Z");

/** The time of day `minutes` after the demo's moment, as the locale writes it. */
export function demoTime(locale: string, minutes: number) {
  return DateTime.formatUtc(DateTime.add(DEMO_MOMENT, { minutes }), {
    locale,
    timeStyle: "short",
  });
}
