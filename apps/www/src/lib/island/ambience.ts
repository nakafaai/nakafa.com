import { Record as Rec, Schema } from "effect";
import { voicesOf } from "@/lib/island/chorus";
import { Weather } from "@/lib/island/sky";
import { Surround } from "@/lib/island/surround";
import { WIND_FORCE } from "@/lib/island/wind";

/**
 * The beds of the world's sound (ADR 0050, W8): the recordings that loop
 * under everything, each named as its file is. The hour, the weather, the
 * wind and what lies about the camera decide how loud each one is.
 */
export const Bed = Schema.Literals([
  "birds",
  "fall",
  "fire",
  "frogs",
  "night",
  "rain",
  "river",
  "roof",
  "sea",
  "wind",
]);
export type Bed = typeof Bed.Type;

/** How loud each bed plays at its fullest, set by ear against the others: rain and a waterfall carry, a night of insects only colors the dark. */
const FULL = {
  birds: 0.45,
  fall: 0.8,
  fire: 0.7,
  frogs: 0.35,
  night: 0.3,
  rain: 0.9,
  river: 0.5,
  roof: 0.6,
  sea: 0.55,
  wind: 0.6,
} as const satisfies Record<Bed, number>;

/** How hard each weather rains, from 0 to 1: a shower, and a storm at full. */
const RAIN = {
  clear: 0,
  clouds: 0,
  rain: 0.7,
  snow: 0,
  storm: 1,
} as const satisfies Record<Weather, number>;

/** What decides the beds: the hour of the learner's day, the weather, how hard a gust blows over the camera now, how much of the land about is under a roof, and what lies about. */
const Scene = Schema.Struct({
  gust: Schema.Finite,
  hour: Schema.Finite,
  roof: Schema.Finite,
  surround: Surround,
  weather: Weather,
});

/** How hard the wind must blow through a wood, the gust over it times the weather's force times the share of wood about, before its leaves are heard. */
const RUSTLE = 0.35;

/** Whether a gust crossing the camera rustles the leaves of the wood about it (ADR 0047, D32). */
export function rustles(gust: number, weather: Weather, forest: number) {
  return gust * WIND_FORCE[weather] * forest > RUSTLE;
}

/**
 * How loud each bed is, from 0 to its fullest (ADR 0050, W8). Birds sing by
 * day as the chorus decides, more in a wood or over a meadow and less by the
 * surf; insects take the night and thin out under rain; frogs call by fresh
 * water at night and in the rain; the sea, a river, a waterfall and a fire
 * are as loud as they are near; rain falls as hard as the weather, and on
 * the roofs as far as there are roofs; and the wind rises with the weather's
 * force and with each gust that crosses the camera.
 */
export function bedsOf(scene: typeof Scene.Type): Record<Bed, number> {
  const { surround, weather } = scene;
  const rain = RAIN[weather];
  const dry = 1 - Math.min(1, rain * 1.4);
  const dark = weather === "snow" ? 0 : voicesOf(scene.hour, "clear").crickets;
  const cover = Math.max(surround.forest, surround.meadow);
  const force = WIND_FORCE[weather];
  const blown = Math.min(1, 0.3 * force + 0.45 * force * scene.gust);
  const heard: Record<Bed, number> = {
    birds:
      voicesOf(scene.hour, weather).birds *
      (0.4 + 0.6 * Math.max(surround.forest, 0.7 * surround.meadow)) *
      (1 - 0.5 * surround.sea),
    fall: surround.fall,
    fire: surround.fire,
    frogs: Math.max(dark, rain) * surround.fresh,
    night: dark * (0.4 + 0.6 * dry) * (0.5 + 0.5 * cover),
    rain,
    river: surround.river,
    roof: rain * scene.roof,
    sea: surround.sea,
    wind: 0.08 + 0.9 * blown * blown,
  };
  return Rec.map(
    heard,
    (loud, bed) => Math.min(1, Math.max(0, loud)) * FULL[bed]
  );
}
