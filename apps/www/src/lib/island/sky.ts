import { DateTime, Match, Option, Schema } from "effect";
import { createStore } from "zustand";

/** The weather an island shows (ADR 0042, D18). */
export const Weather = Schema.Literals([
  "clear",
  "cloudy",
  "rain",
  "storm",
  "snow",
  "fog",
]);
export type Weather = typeof Weather.Type;

/** The light of the day an island shows, from its owner's local hour. */
export const Phase = Schema.Literals(["dawn", "day", "dusk", "night"]);
export type Phase = typeof Phase.Type;

/**
 * The weather a weather-service icon code names (`01d`, `10n`, ...): its first
 * two digits say clear, clouds, rain, thunder, snow or mist. A code it does not
 * know names none.
 */
export function weatherOf(icon: string) {
  return Match.value(icon.slice(0, 2)).pipe(
    Match.whenOr("01", "02", () => Option.some<Weather>("clear")),
    Match.whenOr("03", "04", () => Option.some<Weather>("cloudy")),
    Match.whenOr("09", "10", () => Option.some<Weather>("rain")),
    Match.when("11", () => Option.some<Weather>("storm")),
    Match.when("13", () => Option.some<Weather>("snow")),
    Match.when("50", () => Option.some<Weather>("fog")),
    Match.orElse(() => Option.none<Weather>())
  );
}

/** The hour of the day, with its minutes as a fraction, at an instant in a zone. */
export function hourAt(epochMillis: number, zone: DateTime.TimeZone) {
  const local = DateTime.makeZonedUnsafe(epochMillis, { timeZone: zone });
  return (
    DateTime.getPart(local, "hour") + DateTime.getPart(local, "minute") / 60
  );
}

/**
 * The light of an hour. The island keeps no place, so the hours are the same
 * everywhere: dawn from five, day from half past six, dusk from half past five
 * in the evening, night from seven.
 */
export function phaseAt(hour: number): Phase {
  if (hour >= 19 || hour < 5) {
    return "night";
  }
  if (hour < 6.5) {
    return "dawn";
  }
  return hour < 17.5 ? "day" : "dusk";
}

/** How each light of the day colours the island before it returns to the palette. */
const LIGHT = {
  dawn: { sky: "dusk", tint: [1.02, 0.86, 0.82] },
  day: { sky: "sky", tint: [1, 1, 1] },
  dusk: { sky: "dusk", tint: [1.06, 0.84, 0.66] },
  night: { sky: "night", tint: [0.42, 0.5, 0.86] },
} as const;

/** How much each weather dims the light, and whether it covers the sky. */
const COVER = {
  clear: { dim: 1, overcast: false },
  cloudy: { dim: 0.9, overcast: true },
  fog: { dim: 0.92, overcast: true },
  rain: { dim: 0.82, overcast: true },
  snow: { dim: 0.95, overcast: true },
  storm: { dim: 0.7, overcast: true },
} as const;

/**
 * How the island draws in one light and one weather: the tint every colour
 * takes before the pass returns it to the nearest palette colour, the sky's
 * ramp (grey under clouds, except at night), whether windows and lamps are lit,
 * whether stars and fireflies are out, what falls, and whether fog and
 * lightning show.
 */
export function gradeOf(phase: Phase, weather: Weather) {
  const light = LIGHT[phase];
  const cover = COVER[weather];
  const dark = phase === "night";
  const [r, g, b] = light.tint;
  return {
    fall: Match.value(weather).pipe(
      Match.whenOr("rain", "storm", () => "rain" as const),
      Match.when("snow", () => "snow" as const),
      Match.orElse(() => "none" as const)
    ),
    flash: weather === "storm",
    flies: dark && (weather === "clear" || weather === "cloudy"),
    fog: weather === "fog",
    lit: phase !== "day" || weather === "storm",
    sky: cover.overcast && !dark ? ("overcast" as const) : light.sky,
    stars: dark && weather === "clear",
    tint: [r * cover.dim, g * cover.dim, b * cover.dim] as const,
  };
}

/**
 * The sky of one island frame: its light from the owner's hour and its weather.
 * A clock and the weather read write it, and the canvas reads it every frame.
 * The weather stays clear until a read says otherwise.
 */
export function createSkyStore(phase: Phase) {
  return createStore<{
    readonly phase: Phase;
    readonly weather: Weather;
    setPhase: (phase: Phase) => void;
    setWeather: (weather: Weather) => void;
  }>((set) => ({
    phase,
    setPhase: (next) => set({ phase: next }),
    setWeather: (weather) => set({ weather }),
    weather: "clear",
  }));
}

/** The sky store of one island frame. */
export type SkyStore = ReturnType<typeof createSkyStore>;
