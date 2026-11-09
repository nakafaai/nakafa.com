import { Array as Arr, Schema } from "effect";
import { rgbOf } from "@/lib/island/palette";

const Color = Schema.Tuple([Schema.Finite, Schema.Finite, Schema.Finite]);

/**
 * The light of one moment (ADR 0047, D8): the sky's zenith and horizon, the fog
 * that far blocks fade into, the sun's color on lit faces, the ambient color
 * every face gets, and the lamps' color at night. Each is linear RGB, 0 to 1.
 */
export const Light = Schema.Struct({
  ambient: Color,
  fog: Color,
  horizon: Color,
  lamp: Color,
  sun: Color,
  zenith: Color,
});
export type Light = typeof Light.Type;

/** The weather the island shows, from the owner's own weather (D8). */
export const Weather = Schema.Literals([
  "clear",
  "clouds",
  "rain",
  "storm",
  "snow",
]);
export type Weather = typeof Weather.Type;

/** A color written as `#rrggbb`, with each channel from 0 to 1. */
function rgb(hex: string) {
  const [red, green, blue] = rgbOf(hex);
  return [red / 255, green / 255, blue / 255] as const;
}

/** The light at a few hours of the day; the hours between blend them. */
const KEYS = [
  {
    at: 0,
    zenith: "#0b122e",
    horizon: "#1f2a52",
    sun: "#2a3355",
    ambient: "#2a2e4c",
    lamp: "#ffc874",
  },
  {
    at: 4.8,
    zenith: "#0f1738",
    horizon: "#2c325e",
    sun: "#2c3558",
    ambient: "#2c304e",
    lamp: "#ffc874",
  },
  {
    at: 6,
    zenith: "#405596",
    horizon: "#f0a36c",
    sun: "#e89e70",
    ambient: "#5a556e",
    lamp: "#d9a86a",
  },
  {
    at: 8,
    zenith: "#58a6e4",
    horizon: "#bfe2f0",
    sun: "#fff4dc",
    ambient: "#6e778c",
    lamp: "#000000",
  },
  {
    at: 16.5,
    zenith: "#56a2e2",
    horizon: "#c6e2ec",
    sun: "#fff0d4",
    ambient: "#6e7488",
    lamp: "#000000",
  },
  {
    at: 18.6,
    zenith: "#474080",
    horizon: "#f2885a",
    sun: "#f28c5e",
    ambient: "#584862",
    lamp: "#d9a86a",
  },
  {
    at: 20.2,
    zenith: "#0f1738",
    horizon: "#2c325e",
    sun: "#2c3558",
    ambient: "#2c304e",
    lamp: "#ffc874",
  },
  {
    at: 24,
    zenith: "#0b122e",
    horizon: "#1f2a52",
    sun: "#2a3355",
    ambient: "#2a2e4c",
    lamp: "#ffc874",
  },
] as const;

/** How each weather dims the sun and greys the sky: the sun's share, and how far colors move toward grey. */
const WEATHER = {
  clear: { grey: 0, sun: 1 },
  clouds: { grey: 0.35, sun: 0.7 },
  rain: { grey: 0.55, sun: 0.45 },
  snow: { grey: 0.45, sun: 0.8 },
  storm: { grey: 0.7, sun: 0.3 },
} as const;

/** The color between `a` and `b`, `t` of the way. */
function mix(a: readonly number[], b: readonly number[], t: number) {
  return [
    a[0] + (b[0] - a[0]) * t,
    a[1] + (b[1] - a[1]) * t,
    a[2] + (b[2] - a[2]) * t,
  ] as const;
}

/** A color moved toward its own grey by `t`. */
function greyed(color: readonly number[], t: number) {
  const grey = (color[0] + color[1] + color[2]) / 3;
  return mix(color, [grey, grey, grey], t);
}

/**
 * The light at an hour of the day, from 0 to 24, under a weather: the two
 * nearest keys blended, then greyed and dimmed by the weather.
 */
export function lightOf(hour: number, weather: Weather): Light {
  const at = ((hour % 24) + 24) % 24;
  // The first key is at 0 and the last at 24, so every hour lies between two keys.
  const index = Arr.filter(KEYS, (key) => key.at <= at).length - 1;
  const from = KEYS[index];
  const to = KEYS[index + 1];
  const t = (at - from.at) / (to.at - from.at);
  const blend = (field: "ambient" | "horizon" | "lamp" | "sun" | "zenith") =>
    mix(rgb(from[field]), rgb(to[field]), t);
  const { grey, sun } = WEATHER[weather];
  const horizon = greyed(blend("horizon"), grey);
  return {
    ambient: greyed(blend("ambient"), grey * 0.5),
    fog: horizon,
    horizon,
    lamp: blend("lamp"),
    sun: mix([0, 0, 0], greyed(blend("sun"), grey), sun),
    zenith: greyed(blend("zenith"), grey),
  };
}
