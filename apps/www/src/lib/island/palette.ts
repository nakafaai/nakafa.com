import { Array as Arr, Record } from "effect";

/**
 * Every colour the island draws, in ramps of four tones from shadow to
 * highlight (ADR 0042, D16). Lighting moves a face along its own ramp, so a
 * shaded face is always one of these colours and never a gradient. The ramps
 * lean on Nakafa's identity: the pop green, red, blue and yellow, the cream, and
 * Nina's blue and pale face. Window panes have a ramp of their own, which the
 * night lights; the sky has one ramp for each light of the day and for clouds.
 * Each ramp names its row of the palette texture.
 */
export const RAMPS = {
  ink: { row: 0, tones: ["#0d1730", "#15294f", "#26406e", "#3a5a8c"] },
  grass: { row: 1, tones: ["#2f5a2f", "#467d3c", "#5f9c4b", "#86bf5c"] },
  leaf: { row: 2, tones: ["#1f4630", "#2d653a", "#438644", "#68aa52"] },
  soil: { row: 3, tones: ["#3b2418", "#583720", "#78502d", "#98693c"] },
  stone: { row: 4, tones: ["#454a59", "#5f6577", "#80879a", "#a8aebd"] },
  sand: { row: 5, tones: ["#a47a45", "#c69c5c", "#ddb97c", "#efd6a2"] },
  wood: { row: 6, tones: ["#3d2516", "#5d3a21", "#81552e", "#a67644"] },
  roof: { row: 7, tones: ["#6a1d22", "#a2292d", "#dc3437", "#ef6a55"] },
  slate: { row: 8, tones: ["#1c3150", "#234f7a", "#2878b1", "#4f9ad2"] },
  wall: { row: 9, tones: ["#a08a6b", "#cbb593", "#e8d8b5", "#fff4cc"] },
  water: { row: 10, tones: ["#14466e", "#1a6aa0", "#2492cc", "#39c7f4"] },
  cloud: { row: 11, tones: ["#a9b9cc", "#cfdbe8", "#eaf1f7", "#ffffff"] },
  glow: { row: 12, tones: ["#a6621c", "#e09a2f", "#f1cd1f", "#fff2a8"] },
  nina: { row: 13, tones: ["#1f88b8", "#2fadde", "#39c7f4", "#e3f6fe"] },
  fur: { row: 14, tones: ["#9a4a17", "#d06a20", "#fa8a3a", "#ffc68a"] },
  feather: { row: 15, tones: ["#b9b2a0", "#ddd8c9", "#f4f0e6", "#ffffff"] },
  petal: { row: 16, tones: ["#a83a5a", "#e05a7a", "#ff8fa3", "#ffc2cd"] },
  sky: { row: 17, tones: ["#8fd0f0", "#b3e0f5", "#d4eefa", "#eaf7fd"] },
  pane: { row: 18, tones: ["#1c3150", "#2b5f8e", "#4f9ad2", "#bfe3f7"] },
  dusk: { row: 19, tones: ["#5b3a6e", "#c0587a", "#f08a6a", "#ffc58f"] },
  night: { row: 20, tones: ["#0a1026", "#111a3a", "#1a2752", "#26386b"] },
  overcast: { row: 21, tones: ["#7d8797", "#98a2b1", "#b4bcc8", "#ced4dc"] },
} as const;

/** A ramp of the palette, by name. */
export type Ramp = keyof typeof RAMPS;

/** The tones of one ramp. */
export const TONES_PER_RAMP = 4;

/** The number of colours in the palette. */
export const PALETTE_SIZE = Record.size(RAMPS) * TONES_PER_RAMP;

/** The palette index of one tone of one ramp. */
export function paletteIndex(ramp: Ramp, tone: number) {
  return RAMPS[ramp].row * TONES_PER_RAMP + tone;
}

/** Reads `#rrggbb` as its three channels. */
function channels(hex: string) {
  return [
    Number.parseInt(hex.slice(1, 3), 16),
    Number.parseInt(hex.slice(3, 5), 16),
    Number.parseInt(hex.slice(5, 7), 16),
  ];
}

/**
 * The whole palette as RGBA bytes, one texel per colour at its palette index,
 * for the texture the shaders look colours up in.
 */
export function paletteBytes() {
  const bytes = new Uint8Array(PALETTE_SIZE * 4);
  Arr.forEach(Record.values(RAMPS), (ramp) => {
    Arr.forEach(ramp.tones, (hex, tone) => {
      bytes.set(
        [...channels(hex), 255],
        (ramp.row * TONES_PER_RAMP + tone) * 4
      );
    });
  });
  return bytes;
}
