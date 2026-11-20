import { Array as Arr, DateTime, Option, Schema } from "effect";
import type { Rgb } from "@/lib/island/oklab";
import { blendLab, greyedLab } from "@/lib/island/oklab";
import { rgbOf } from "@/lib/island/palette";

const Color = Schema.Tuple([Schema.Finite, Schema.Finite, Schema.Finite]);

/**
 * The light of one moment (ADR 0047, D8): the sky's zenith and horizon, which
 * far blocks also fade into (D35), the sun's color on lit faces, the ambient
 * color every face gets, and the lamps' color at night, each as the screen
 * shows it, from 0 to 1; and `toward`, the unit direction toward the sun by
 * day and the moon by night, which faces are lit from and shadows fall away
 * from.
 */
export const Light = Schema.Struct({
  ambient: Color,
  horizon: Color,
  lamp: Color,
  sun: Color,
  toward: Color,
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
function rgb(hex: string): Rgb {
  const [red, green, blue] = rgbOf(hex);
  return [red / 255, green / 255, blue / 255];
}

/**
 * Where the light comes from across the ground: always the upper left of the
 * island as the opening camera sees it, the side the tiles' own pixel shading
 * is drawn for, so a face's painted light and its shadow agree.
 */
const ACROSS = [
  -0.45 / Math.hypot(0.45, 0.4),
  0.4 / Math.hypot(0.45, 0.4),
] as const;

/** When the sun rises and sets, in hours. */
const DAY = { rise: 6, set: 18.6 } as const;

/**
 * The direction toward the light at an hour: the sun climbs from 20 degrees at
 * sunrise to 60 at midday and sinks again, so morning and evening shadows run
 * long; the moon stands at 45 degrees all night. The angle keeps to whole
 * degrees, so a shadow's edge holds still between two of them.
 */
export function towardOf(hour: number): Rgb {
  const at = ((hour % 24) + 24) % 24;
  const day = at >= DAY.rise && at < DAY.set;
  const share = (at - DAY.rise) / (DAY.set - DAY.rise);
  const degrees = day ? Math.round(20 + 40 * Math.sin(Math.PI * share)) : 45;
  const angle = (degrees * Math.PI) / 180;
  return [
    ACROSS[0] * Math.cos(angle),
    Math.sin(angle),
    ACROSS[1] * Math.cos(angle),
  ];
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

/**
 * The light at an hour of the day, from 0 to 24, under a weather: the two
 * nearest keys blended in OKLab, then greyed and dimmed by the weather.
 */
export function lightOf(hour: number, weather: Weather): Light {
  const at = ((hour % 24) + 24) % 24;
  // The first key is at 0 and the last at 24, so every hour lies between two keys.
  const index = Arr.filter(KEYS, (key) => key.at <= at).length - 1;
  const from = KEYS[index];
  const to = KEYS[index + 1];
  const t = (at - from.at) / (to.at - from.at);
  const blend = (field: "ambient" | "horizon" | "lamp" | "sun" | "zenith") =>
    blendLab(rgb(from[field]), rgb(to[field]), t);
  const { grey, sun } = WEATHER[weather];
  return {
    ambient: greyedLab(blend("ambient"), grey * 0.5),
    horizon: greyedLab(blend("horizon"), grey),
    lamp: blend("lamp"),
    sun: blendLab([0, 0, 0], greyedLab(blend("sun"), grey), sun),
    toward: towardOf(at),
    zenith: greyedLab(blend("zenith"), grey),
  };
}

/**
 * The island's weather from an OpenWeather icon code, as the weather route
 * reports it: thunder is a storm, rain and drizzle are rain, snow is snow, a
 * sky with clouds, mist or haze is clouds, and anything else is clear.
 */
export function weatherOf(icon: string): Weather {
  const code = icon.slice(0, 2);
  if (code === "11") {
    return "storm";
  }
  if (code === "09" || code === "10") {
    return "rain";
  }
  if (code === "13") {
    return "snow";
  }
  return code === "01" ? "clear" : "clouds";
}

/**
 * How the weather falls (ADR 0047, D8): its speed in cells a second, the length
 * of a streak and the sway of a flake in cells, its linear RGBA color, and
 * whether it falls as flakes (points) or streaks (lines).
 */
const Fall = Schema.Struct({
  color: Schema.Tuple([
    Schema.Finite,
    Schema.Finite,
    Schema.Finite,
    Schema.Finite,
  ]),
  count: Schema.Int,
  flakes: Schema.Boolean,
  length: Schema.Finite,
  speed: Schema.Finite,
  sway: Schema.Finite,
});
type Fall = typeof Fall.Type;

/** Rain: fast slanted streaks. */
// Light enough to show the weather without hiding the world under it: few, faint drops whose tails fade.
const RAIN: Fall = {
  color: [0.86, 0.92, 1, 0.42],
  count: 320,
  flakes: false,
  length: 1.1,
  speed: 22,
  sway: 0,
};

/** What falls from each sky: rain, heavier rain in a storm, slow drifting snow, and nothing from a clear or cloudy one. */
export function fallOf(weather: Weather): Option.Option<Fall> {
  if (weather === "rain") {
    return Option.some(RAIN);
  }
  if (weather === "storm") {
    return Option.some({
      ...RAIN,
      color: [0.86, 0.92, 1, 0.5],
      count: 560,
      length: 1.6,
      speed: 30,
    });
  }
  return weather === "snow"
    ? Option.some({
        color: [0.97, 0.98, 1, 0.9],
        count: 420,
        flakes: true,
        length: 0,
        speed: 2.2,
        sway: 0.6,
      })
    : Option.none();
}

/** The hour of a moment in a zone, from 0 to 24 with its minutes, the hour the island's light follows. */
export function hourOf(now: DateTime.DateTime, zone: DateTime.TimeZone) {
  const zoned = DateTime.setZone(now, zone);
  return (
    DateTime.getPart(zoned, "hour") + DateTime.getPart(zoned, "minute") / 60
  );
}
