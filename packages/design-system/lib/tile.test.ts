import { describe, expect, it } from "@effect/vitest";
import { getWcagContrast } from "@repo/design-system/lib/theme/contrast";
import { getTileGradient } from "@repo/design-system/lib/tile";
import Color from "colorjs.io";
import { Array as Arr, HashMap, HashSet, Order } from "effect";

/** One gradient between two tones, as `background-image` takes it. */
const TILE_PATTERN =
  /^linear-gradient\((\d+)deg,(oklch\(0\.56 0\.12 (\d+)\)),(oklch\(0\.66 0\.125 (\d+)\))\)$/u;
/** These seeds reach all 360 hues, both sides of each, and all eight directions. */
const SEEDS = Arr.makeBy(10_000, (index) => `seed-${index}`);
/**
 * The icon of the row tile is 16px (size-4) on a 40px tile (size-10), so it
 * covers the middle 40 percent of the blend. The tile, not this number, owns
 * those sizes, and the banner's 24px icon on a wide tile covers less.
 */
const ICON_SHARE = 16 / 40;
/** The middle and the far end of the icon's span. Lightness rises along the blend, so the far end is the weakest. */
const POSITIONS = [0.5, 0.5 + ICON_SHARE / 2];
/** WCAG 2.1 criterion 1.4.11: a graphic that carries meaning needs 3:1. */
const MINIMUM_ICON_CONTRAST = 3;

/**
 * Effect's `Hash.string` turns a seed into a number, so these tiles are pinned
 * only to show an Effect upgrade that changes it. The empty seed is one of them:
 * it hashes like any other seed and needs no fallback.
 */
const PINNED = [
  ["", "linear-gradient(315deg,oklch(0.56 0.12 341),oklch(0.66 0.125 307))"],
  [
    "aljabar",
    "linear-gradient(315deg,oklch(0.56 0.12 314),oklch(0.66 0.125 348))",
  ],
  [
    "gerak",
    "linear-gradient(90deg,oklch(0.56 0.12 215),oklch(0.66 0.125 249))",
  ],
  [
    "tryout/indonesia/snbt",
    "linear-gradient(45deg,oklch(0.56 0.12 293),oklch(0.66 0.125 327))",
  ],
  [
    "curriculum/merdeka",
    "linear-gradient(225deg,oklch(0.56 0.12 182),oklch(0.66 0.125 148))",
  ],
] as const;

/** Reads the angle, both tones, and both hues out of one seed's gradient. */
function readTile(seed: string) {
  const match = TILE_PATTERN.exec(getTileGradient(seed));

  return {
    angle: Number(match?.[1]),
    beside: Number(match?.[5]),
    from: String(match?.[2]),
    hue: Number(match?.[3]),
    to: String(match?.[4]),
  };
}

const TILES = Arr.map(SEEDS, readTile);

/** Lists each number once, from the smallest. */
function distinct(values: readonly number[]) {
  return Arr.sort(Arr.fromIterable(HashSet.fromIterable(values)), Order.Number);
}

/** Measures white against the painted blend of two tones at each position. */
function whiteContrasts(from: string, to: string) {
  const blend = new Color(from).range(new Color(to), { space: "oklab" });

  return Arr.map(POSITIONS, (position) =>
    getWcagContrast(
      blend(position).toGamut({ space: "srgb" }).toString(),
      "#ffffff"
    )
  );
}

describe("getTileGradient", () => {
  it.each(PINNED)("keeps the tile of %j", (seed, want) => {
    expect(getTileGradient(seed)).toBe(want);
  });

  it("gives the same seed the same tile every time", () => {
    const sample = Arr.take(SEEDS, 500);

    expect(Arr.map(sample, getTileGradient)).toEqual(
      Arr.map(sample, getTileGradient)
    );
  });

  it("uses every hue and every one of the eight directions", () => {
    expect(distinct(Arr.map(TILES, ({ hue }) => hue))).toHaveLength(360);
    expect(distinct(Arr.map(TILES, ({ angle }) => angle))).toEqual([
      0, 45, 90, 135, 180, 225, 270, 315,
    ]);
  });

  it("keeps the second tone 34 degrees to the left or right of the first", () => {
    const gaps = Arr.map(
      TILES,
      ({ beside, hue }) => (beside - hue + 360) % 360
    );

    expect(distinct(gaps)).toEqual([34, 326]);
  });

  it("keeps a white icon at 3:1 wherever the icon sits, on every hue pair", () => {
    const pairs = Arr.fromIterable(
      HashMap.values(
        HashMap.fromIterable(
          Arr.map(
            TILES,
            (tile) => [`${tile.hue}:${tile.beside}`, tile] as const
          )
        )
      )
    );

    expect(pairs).toHaveLength(720);

    for (const { from, to } of pairs) {
      for (const contrast of whiteContrasts(from, to)) {
        expect(contrast).toBeGreaterThanOrEqual(MINIMUM_ICON_CONTRAST);
      }
    }
  });
});
