/**
 * The island's palette (ADR 0047, D4): warm, saturated ramps of four tones each,
 * from shadow to highlight. Every pixel of every tile and sprite is one of these
 * colors; night, dusk and rain tint them in the shader instead of adding new ones.
 */
export const RAMPS = {
  grass: ["#3d7436", "#589a42", "#7abb4c", "#a6d666"],
  leaf: ["#2c5831", "#3e7839", "#5a9742", "#84b654"],
  soil: ["#583925", "#775032", "#94683f", "#b2844e"],
  stone: ["#5c5d66", "#7a7b83", "#99999f", "#bbbbbd"],
  sand: ["#c6a168", "#daba7c", "#e8cf97", "#f4e2b2"],
  bark: ["#472e1f", "#65422e", "#805639", "#9a6c47"],
  wood: ["#865730", "#a56c3c", "#c2884d", "#dba866"],
  water: ["#276b9b", "#3788bc", "#55a6d4", "#9cd4ed"],
  brick: ["#76372a", "#994733", "#ba5f42", "#d6845e"],
  roof: ["#7a2828", "#a33a30", "#c6573e", "#e27d56"],
  slate: ["#2c3d5b", "#3e557b", "#58729a", "#7d95b7"],
  plaster: ["#c6b9a3", "#dcd1bc", "#eae2d1", "#f7f2e7"],
  gravel: ["#7a6a55", "#93826d", "#a99882", "#c0b19a"],
  glass: ["#7cb3c7", "#a3d2e0", "#cbe8f1", "#f1faff"],
  metal: ["#2b2729", "#474144", "#675f63", "#898185"],
  glow: ["#dd8628", "#f0b141", "#f9d16b", "#fff0b6"],
  wool: ["#9b3c50", "#c15468", "#da7886", "#eea1aa"],
  marble: ["#bab3ab", "#d6d0c8", "#e9e4dd", "#f9f7f3"],
  gold: ["#976813", "#c6911f", "#e6b93a", "#fadf88"],
  petal: ["#a82f52", "#d4476a", "#f0708a", "#f9a8b8"],
  bloom: ["#c28a1c", "#e8b52e", "#f5cf4a", "#fdec9a"],
  ink: ["#2a1e1a", "#3b2b25", "#4e3a31", "#634b40"],
  book: ["#8e2f2f", "#2f4e8e", "#3d7a3a", "#c28a1c"],
} as const;

/** The name of one ramp of the palette. */
export type Ramp = keyof typeof RAMPS;

/** A tone of a ramp, from 0 (shadow) to 3 (highlight). */
export type Tone = 0 | 1 | 2 | 3;

/** A color written as `#rrggbb`, as its red, green and blue from 0 to 255. */
export function rgbOf(hex: string) {
  return [
    Number.parseInt(hex.slice(1, 3), 16),
    Number.parseInt(hex.slice(3, 5), 16),
    Number.parseInt(hex.slice(5, 7), 16),
  ] as const;
}

/** The color of one tone of one ramp, as its red, green and blue from 0 to 255. */
export function colorOf(ramp: Ramp, tone: Tone) {
  return rgbOf(RAMPS[ramp][tone]);
}

/** The tone a value in [0, 1) falls on, in four equal bands from shadow to highlight. */
export function toneOf(unit: number): Tone {
  if (unit < 0.25) {
    return 0;
  }
  if (unit < 0.5) {
    return 1;
  }
  return unit < 0.75 ? 2 : 3;
}
