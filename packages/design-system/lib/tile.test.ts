import { describe, expect, it } from "@effect/vitest";
import { getWcagContrast } from "@repo/design-system/lib/theme/contrast";
import {
  getTileGradient,
  getTileLooks,
  getTileShifts,
  TILE_HUE_GAP,
} from "@repo/design-system/lib/tile";
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
/** A list of this many tiles always finds room: five tiles before it hide at most 355 of 360 hues. */
const LONGEST_SURE_LIST = 6;

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
function readTile(seed: string, shift?: number) {
  const match = TILE_PATTERN.exec(getTileGradient(seed, shift));

  return {
    angle: Number(match?.[1]),
    beside: Number(match?.[5]),
    from: String(match?.[2]),
    hue: Number(match?.[3]),
    to: String(match?.[4]),
  };
}

const TILES = Arr.map(SEEDS, (seed) => readTile(seed));

/** Lists each number once, from the smallest. */
function distinct(values: readonly number[]) {
  return Arr.sort(Arr.fromIterable(HashSet.fromIterable(values)), Order.Number);
}

/** The hue halfway between the two tones of one tile, which is the hue the eye takes it to have. */
function middleOf({ beside, hue }: { beside: number; hue: number }) {
  const lean = (beside - hue + 360) % 360 === 34 ? 17 : -17;

  return (hue + lean + 360) % 360;
}

/** The middle hue of the tile that a seed and a shift give. */
function middleAt(seed: string, shift: number) {
  return middleOf(readTile(seed, shift));
}

/** The distance between two hues, the short way around the wheel. */
function apart(left: number, right: number) {
  const gap = Math.abs(left - right);

  return Math.min(gap, 360 - gap);
}

/** The least distance between any two hues of a list. */
function leastDistance(hues: readonly number[]) {
  return Arr.reduce(hues, 360, (least, hue, index) =>
    Arr.reduce(Arr.drop(hues, index + 1), least, (nearest, other) =>
      Math.min(nearest, apart(hue, other))
    )
  );
}

/** The middle hue of each tile of a list after its shifts. */
function middlesOf(seeds: readonly string[]) {
  return Arr.zipWith(seeds, getTileShifts(seeds), middleAt);
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

    expect(Arr.map(sample, (seed) => getTileGradient(seed))).toEqual(
      Arr.map(sample, (seed) => getTileGradient(seed))
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

  it("turns both tones by the shift and keeps the side and the direction", () => {
    const plain = readTile("aljabar");
    const turned = readTile("aljabar", 100);

    expect(turned.hue).toBe((plain.hue + 100) % 360);
    expect(turned.beside).toBe((plain.beside + 100) % 360);
    expect(turned.angle).toBe(plain.angle);
  });

  it("takes a shift that passes the end of the wheel back to the start", () => {
    expect(readTile("aljabar", 359).hue).toBe(313);
    expect(readTile("aljabar", 359).beside).toBe(347);
  });

  it("gives a shift of 0 the tile of the seed alone", () => {
    expect(getTileGradient("gerak", 0)).toBe(getTileGradient("gerak"));
  });
});

describe("getTileShifts", () => {
  it("keeps the look of tiles that have room", () => {
    expect(getTileShifts(["gerak", "curriculum/merdeka"])).toEqual([0, 0]);
    expect(getTileShifts([])).toEqual([]);
  });

  it("moves a tile that is too close to the tile before it to the next free hue", () => {
    const seeds = ["aljabar", "tryout/indonesia/snbt"];

    expect(getTileShifts(seeds)).toEqual([0, 57]);
    expect(middlesOf(seeds)).toEqual([331, 7]);
  });

  it("keeps a tile where it is whatever comes after it", () => {
    const list = Arr.take(SEEDS, 9);

    for (const length of [1, 3, 6]) {
      expect(getTileShifts(Arr.take(list, length))).toEqual(
        Arr.take(getTileShifts(list), length)
      );
    }
  });

  it(`keeps the middles of any ${LONGEST_SURE_LIST} tiles at least ${TILE_HUE_GAP} degrees apart`, () => {
    for (const seeds of Arr.chunksOf(SEEDS, LONGEST_SURE_LIST)) {
      expect(leastDistance(middlesOf(seeds))).toBeGreaterThanOrEqual(
        TILE_HUE_GAP
      );
    }
  });

  it("spreads ten tiles that start together evenly around the wheel", () => {
    const seeds = Arr.replicate("aljabar", 10);

    expect(middlesOf(seeds)).toEqual(
      Arr.makeBy(10, (step) => (331 + TILE_HUE_GAP * step) % 360)
    );
  });

  it("gives tiles past the last free hue the hue farthest from the rest", () => {
    const seeds = Arr.replicate("aljabar", 12);
    const middles = middlesOf(seeds);

    expect(Arr.take(middles, 10)).toEqual(
      Arr.makeBy(10, (step) => (331 + TILE_HUE_GAP * step) % 360)
    );
    expect(Arr.drop(middles, 10)).toEqual([349, 25]);
    expect(distinct(middles)).toHaveLength(12);
  });
});

/** Five drawings that differ from each other, as a pool of icons. */
const POOL = Arr.makeBy(
  5,
  (index) => [["path", { d: `M${index} 0` }]] as const
);
/** Three more drawings, as the pool of another subject. */
const OTHER = Arr.makeBy(
  3,
  (index) => [["path", { d: `M0 ${index}` }]] as const
);
/** The pool of one icon that a key with its own icon offers. */
const ALONE = [[["path", { d: "M9 9" }]] as const] as const;

/** The icons that a list of tiles takes from one pool, one tile per seed. */
function iconsFor(seeds: readonly string[]) {
  return Arr.map(
    getTileLooks(Arr.map(seeds, (seed) => [POOL, seed] as const)),
    ({ icon }) => icon
  );
}

describe("getTileLooks", () => {
  it("starts a tile from the icon its seed points at", () => {
    expect(iconsFor(["aljabar"])).toEqual([POOL[1]]);
    expect(iconsFor(["gerak"])).toEqual([POOL[3]]);
  });

  it("reaches every icon of a pool from different seeds", () => {
    const icons = Arr.map(Arr.take(SEEDS, 200), (seed) => iconsFor([seed]));

    expect(Arr.dedupe(icons)).toHaveLength(5);
  });

  it("moves a tile whose icon is held to the next icon of its pool", () => {
    expect(iconsFor(Arr.replicate("aljabar", 3))).toEqual([
      POOL[1],
      POOL[2],
      POOL[3],
    ]);
  });

  it("goes round the end of the pool", () => {
    expect(iconsFor(Arr.replicate("gerak", 3))).toEqual([
      POOL[3],
      POOL[4],
      POOL[0],
    ]);
  });

  it("repeats an icon only once the whole pool is held, the least held first", () => {
    expect(iconsFor(Arr.replicate("aljabar", 7))).toEqual(
      Arr.map([1, 2, 3, 4, 0, 1, 2], (place) => POOL[place])
    );
  });

  it("keeps the pools of different tiles apart", () => {
    const looks = getTileLooks([
      [POOL, "aljabar"],
      [OTHER, "aljabar"],
      [POOL, "aljabar"],
    ]);

    expect(Arr.map(looks, ({ icon }) => icon)).toEqual([
      POOL[1],
      OTHER[0],
      POOL[2],
    ]);
  });

  it("gives a pool of one icon to every tile that names it", () => {
    const looks = getTileLooks([
      [ALONE, "aljabar"],
      [ALONE, "gerak"],
    ]);

    expect(Arr.map(looks, ({ icon }) => icon)).toEqual([ALONE[0], ALONE[0]]);
  });

  it("turns each tile as getTileShifts does", () => {
    const seeds = ["aljabar", "tryout/indonesia/snbt"];
    const looks = getTileLooks(Arr.map(seeds, (seed) => [POOL, seed] as const));

    expect(Arr.map(looks, ({ shift }) => shift)).toEqual(getTileShifts(seeds));
  });

  it("gives each tile back the seed that its list placed it by", () => {
    const seeds = ["aljabar", "gerak", "curriculum/merdeka"];
    const looks = getTileLooks(Arr.map(seeds, (seed) => [POOL, seed] as const));

    expect(Arr.map(looks, ({ seed }) => seed)).toEqual(seeds);
  });

  it("gives nothing for a list of nothing", () => {
    expect(getTileLooks([])).toEqual([]);
  });
});
