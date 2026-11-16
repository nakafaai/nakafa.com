import { SPAN } from "@repo/backend/confect/island/world";
import { KIND, LOOK } from "@/lib/island/look";
import { skylineOf } from "@/lib/island/mesh";
import type { Weather } from "@/lib/island/sky";
import { blockAt, type Cells, SEA_LEVEL } from "@/lib/island/world";

/**
 * What the weather leaves on the island (ADR 0047, D33): where a falling drop
 * stops, how wet the ground is, and how much snow lies on it. Rain and snow
 * stop on the first thing over a column, so a roof keeps the ground under it
 * dry; the ground wets as it rains and dries after; snow settles on what
 * faces the sky and melts once it stops.
 */

/**
 * The roof map: for each column of the world, one byte the shaders read.
 * Twice the height a drop stops at, plus one when it stops on water, where it
 * rings instead of splashing. An empty column, open to the sea floor, reads
 * as the sea.
 */
export function roofOf(cells: Cells) {
  const skyline = skylineOf(cells);
  const roof = new Uint8Array(SPAN * SPAN);
  for (let z = 0; z < SPAN; z += 1) {
    for (let x = 0; x < SPAN; x += 1) {
      const top = skyline[z * SPAN + x];
      const liquid =
        top < 0 || LOOK.kinds[blockAt(cells, x, top, z)] === KIND.liquid;
      const height = top < 0 ? SEA_LEVEL : top + 1;
      roof[z * SPAN + x] = height * 2 + (liquid ? 1 : 0);
    }
  }
  return roof;
}

/**
 * How fast each weather wets, dries, buries and melts, as a share of the whole
 * a second: a shower soaks the ground in half a minute and a storm in twelve
 * seconds; the sun dries it in four minutes and a grey sky in seven. Snow
 * covers the ground in two and a half minutes, rain melts it in one, the sun
 * in five.
 */
const RATES = {
  clear: { snow: -1 / 300, wet: -1 / 240 },
  clouds: { snow: -1 / 600, wet: -1 / 420 },
  rain: { snow: -1 / 60, wet: 1 / 30 },
  snow: { snow: 1 / 150, wet: 0 },
  storm: { snow: -1 / 45, wet: 1 / 12 },
} as const satisfies Record<Weather, Record<"snow" | "wet", number>>;

/** The longest step the cover is moved on in at once, in seconds, so a tab that slept does not soak or dry the island at once. */
const STEP = 0.25;

/** How wet the ground is and how much snow lies on it, each from 0 to 1. */
export function createCover() {
  return { snow: 0, wet: 0 };
}

/** The cover after `elapsed` seconds under a weather. */
export function stepCover(
  cover: ReturnType<typeof createCover>,
  weather: Weather,
  elapsed: number
) {
  const dt = Math.min(Math.max(elapsed, 0), STEP);
  const rate = RATES[weather];
  cover.wet = Math.min(1, Math.max(0, cover.wet + rate.wet * dt));
  cover.snow = Math.min(1, Math.max(0, cover.snow + rate.snow * dt));
}
