import { grainAt } from "@repo/design-system/components/three/stage/grain";
import { Schema } from "effect";

/** The real surfaces a lab object is made of, each with its own fine detail. */
export const SurfaceSchema = Schema.Literals([
  "bark",
  "brushed",
  "cloth",
  "concrete",
  "paint",
  "plastic",
  "rubber",
  "wood",
]);
export type Surface = typeof SurfaceSchema.Type;

/**
 * How one surface varies across a tile: how far its tone dips below the
 * object's colour, how rough it is at its smoothest and how much rougher its
 * worn places get, and how deep its relief is.
 */
const LookSchema = Schema.Struct({
  dip: Schema.Finite,
  relief: Schema.Finite,
  rough: Schema.Finite,
  wear: Schema.Finite,
});

const LOOKS: Record<Surface, typeof LookSchema.Type> = {
  bark: { dip: 0.55, relief: 1, rough: 0.9, wear: 0.06 },
  brushed: { dip: 0.16, relief: 0.25, rough: 0.28, wear: 0.18 },
  cloth: { dip: 0.22, relief: 0.8, rough: 0.82, wear: 0.1 },
  concrete: { dip: 0.24, relief: 0.6, rough: 0.88, wear: 0.1 },
  paint: { dip: 0.14, relief: 0.2, rough: 0.38, wear: 0.34 },
  plastic: { dip: 0.06, relief: 0.12, rough: 0.42, wear: 0.12 },
  rubber: { dip: 0.12, relief: 0.35, rough: 0.86, wear: 0.08 },
  wood: { dip: 0.34, relief: 0.55, rough: 0.62, wear: 0.16 },
};

/**
 * The pattern of each surface at a place of the tile, between 0 and 1, where
 * 1 is the surface at its cleanest and brightest. Bark is split by deep
 * furrows along the trunk, brushed metal is streaked
 * along its length, cloth is a plain weave, concrete is mottled and
 * pitted with its aggregate, paint is smooth with soft
 * blotches of grime and scuffs, plastic is nearly even, rubber is finely
 * pitted, and wood runs in long grain with darker growth rings.
 */
/**
 * Grain that runs along the tile: fine lines across it, which vary only
 * slowly along it, so the tile still repeats without a seam.
 */
function streakAt(x: number, y: number, seed: number) {
  return 0.8 * grainAt(0, y, 64, seed) + 0.2 * grainAt(x, y, 4, seed + 1);
}

const PATTERNS: Record<Surface, (x: number, y: number) => number> = {
  bark: (x, y) => {
    const furrow = Math.abs(
      Math.sin((x * 12 + 0.6 * grainAt(x, y, 4, 43)) * Math.PI)
    );
    return 0.25 + 0.55 * furrow ** 0.6 + 0.2 * grainAt(x, y, 32, 47);
  },
  brushed: (x, y) => 0.55 + 0.45 * streakAt(x, y, 3),
  cloth: (x, y) => {
    const warp = Math.sin(x * Math.PI * 128) ** 2;
    const weft = Math.sin(y * Math.PI * 128) ** 2;
    // Warp and weft cross over and under each other in alternate threads.
    const over = (Math.floor(x * 128) + Math.floor(y * 128)) % 2;
    return (
      0.5 +
      0.35 * (over * warp + (1 - over) * weft) +
      0.15 * grainAt(x, y, 8, 5)
    );
  },
  concrete: (x, y) =>
    0.55 +
    0.3 * grainAt(x, y, 16, 59) +
    0.15 * Number(grainAt(x, y, 64, 61) <= 0.62),
  paint: (x, y) =>
    1 - 0.7 * grainAt(x, y, 4, 11) ** 3 - 0.3 * grainAt(x, y, 32, 17) ** 4,
  plastic: (x, y) => 0.8 + 0.2 * grainAt(x, y, 16, 23),
  rubber: (x, y) => 0.6 + 0.4 * grainAt(x, y, 64, 29),
  wood: (x, y) => {
    const ring = Math.sin((y * 9 + 0.35 * grainAt(x, y, 2, 31)) * Math.PI * 2);
    return 0.45 + 0.3 * ring ** 2 + 0.25 * streakAt(x, y, 37);
  },
};

/**
 * Paints the fine detail of one surface as three square images of `size`
 * pixels that tile without a seam, four bytes a pixel. `tone` multiplies the
 * object's own colour, so one image serves every colour of that surface;
 * `rough` holds the roughness in its green channel, where a renderer reads
 * it; `relief` is a height, a brighter pixel standing higher.
 */
export function paintDetail(surface: Surface, size: number) {
  const { dip, relief, rough, wear } = LOOKS[surface];
  const tone = new Uint8ClampedArray(size * size * 4);
  const roughness = new Uint8ClampedArray(size * size * 4);
  const height = new Uint8ClampedArray(size * size * 4);
  for (let pixel = 0; pixel < size * size; pixel += 1) {
    const x = (pixel % size) / size;
    const y = Math.floor(pixel / size) / size;
    const pattern = Math.min(1, Math.max(0, PATTERNS[surface](x, y)));
    const worn = grainAt(x, y, 8, 41);
    const at = pixel * 4;
    const shade = (1 - dip * (1 - pattern)) * 255;
    tone[at] = shade;
    tone[at + 1] = shade;
    tone[at + 2] = shade;
    tone[at + 3] = 255;
    const grit = Math.min(1, rough + wear * worn * (1.2 - pattern));
    roughness[at] = 255;
    roughness[at + 1] = grit * 255;
    roughness[at + 2] = 255;
    roughness[at + 3] = 255;
    const lift = (0.5 + relief * (pattern - 0.5)) * 255;
    height[at] = lift;
    height[at + 1] = lift;
    height[at + 2] = lift;
    height[at + 3] = 255;
  }
  return { height, roughness, tone };
}
