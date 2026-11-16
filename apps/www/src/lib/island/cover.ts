import type { Weather } from "@/lib/island/sky";

/**
 * What the weather leaves on the island (ADR 0047, D33): how wet the ground
 * is, and how much snow lies on it. The ground wets as it rains and dries
 * after; snow settles on what faces the sky and melts once it stops. Where a
 * drop stops is the column map's (D39), so a roof keeps the ground under it
 * dry.
 */

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
