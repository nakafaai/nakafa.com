import { describe, expect, it } from "@effect/vitest";
import {
  getTileIcon,
  getTileLooks,
  getTileShifts,
  TILE_HUE_GAP,
} from "@repo/design-system/lib/look";
import { getTileGradient } from "@repo/design-system/lib/tile";
import { Array as Arr, HashSet } from "effect";

/** The two hues of one gradient, as `getTileGradient` paints them. */
const HUES =
  /^linear-gradient\(\d+deg,oklch\(0\.56 0\.12 (\d+)\),oklch\(0\.66 0\.125 (\d+)\)\)$/u;
/** These seeds reach every hue. */
const SEEDS = Arr.makeBy(10_000, (index) => `seed-${index}`);
/** A list of this many tiles always finds room: five tiles before it hide at most 355 of 360 hues. */
const LONGEST_SURE_LIST = 6;

/** The hue halfway between the two tones that a seed and a shift paint, which is the hue the eye takes the tile to have. */
function middleAt(seed: string, shift: number) {
  const match = HUES.exec(getTileGradient(seed, shift));
  const hue = Number(match?.[1]);
  const lean = (Number(match?.[2]) - hue + 360) % 360 === 34 ? 17 : -17;

  return (hue + lean + 360) % 360;
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

/** The middle hue of each tile of a list after its shifts, with the tiles that the page shows before it. */
function middlesOf(
  seeds: readonly string[],
  shown: Parameters<typeof getTileShifts>[1] = []
) {
  return Arr.zipWith(seeds, getTileShifts(seeds, shown), middleAt);
}

/** The middle of "aljabar", the tile that every test below puts on the page or in a list. */
const ALJABAR = middleAt("aljabar", 0);

/** A tile of the page that is drawn with this middle hue. */
function at(middle: number) {
  return { seed: "aljabar", shift: (middle - ALJABAR + 360) % 360 };
}

describe("getTileShifts", () => {
  it("keeps the look of tiles that have room", () => {
    expect(getTileShifts(["gerak", "curriculum/merdeka"])).toEqual([0, 0]);
    expect(getTileShifts([])).toEqual([]);
  });

  it("moves a tile that is too close to the tile before it to the next free hue", () => {
    const seeds = ["aljabar", "tryout/indonesia/snbt"];

    expect(getTileShifts(seeds)).toEqual([0, 57]);
    expect(middlesOf(seeds)).toEqual([331, 7]);
    expect(getTileShifts(["aljabar", ""])).toEqual([0, 43]);
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
      Arr.makeBy(10, (step) => (ALJABAR + TILE_HUE_GAP * step) % 360)
    );
  });

  it("gives tiles past the last free hue the hue farthest from the rest", () => {
    const seeds = Arr.replicate("aljabar", 12);
    const middles = middlesOf(seeds);

    expect(Arr.take(middles, 10)).toEqual(
      Arr.makeBy(10, (step) => (ALJABAR + TILE_HUE_GAP * step) % 360)
    );
    expect(Arr.drop(middles, 10)).toEqual([349, 25]);
    expect(HashSet.size(HashSet.fromIterable(middles))).toBe(12);
  });

  it("moves a tile that is too close to a tile of the page to the next hue that has room from it", () => {
    const own = middleAt("gerak", 0);

    expect(getTileShifts(["gerak"], [at(100)])).toEqual([0]);
    expect(getTileShifts(["gerak"], [at(own)])).toEqual([TILE_HUE_GAP]);
    expect(getTileShifts(["gerak"], [at(own + 20)])).toEqual([56]);
    expect(middlesOf(["aljabar", "aljabar"], [at(7)])).toEqual([ALJABAR, 43]);
  });

  it("takes the hue farthest from the page when no hue has room from it", () => {
    const wheel = Arr.makeBy(10, (step) => at(step * TILE_HUE_GAP));

    expect(middlesOf(["gerak"], wheel)).toEqual([234]);
  });

  it("keeps the gap inside the list whatever the page shows", () => {
    const own = ALJABAR;
    const wall = Arr.map([71, 141, 211, 281, 323], (step) => at(own + step));

    expect(middlesOf(["aljabar", "aljabar"], wall)).toEqual([own, 7]);

    for (const seeds of Arr.chunksOf(SEEDS, LONGEST_SURE_LIST)) {
      expect(leastDistance(middlesOf(seeds, wall))).toBeGreaterThanOrEqual(
        TILE_HUE_GAP
      );
    }
  });

  it("keeps a tile where it is whatever comes after it, with the page shown", () => {
    const list = Arr.take(SEEDS, 9);
    const shown = [at(100), at(200)];

    for (const length of [1, 3, 6]) {
      expect(getTileShifts(Arr.take(list, length), shown)).toEqual(
        Arr.take(getTileShifts(list, shown), length)
      );
    }
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

/** A tile of the page that holds this icon. */
function holding(icon: (typeof POOL)[number]) {
  return { icon, seed: "gerak", shift: 0 };
}

/** The icons that a list of tiles takes from one pool, one tile per seed, after the tiles that the page shows. */
function iconsFor(
  seeds: readonly string[],
  shown: readonly ReturnType<typeof holding>[] = []
) {
  return Arr.map(
    getTileLooks(
      Arr.map(seeds, (seed) => [POOL, seed] as const),
      shown
    ),
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

  it("skips an icon that a tile of the page holds while the pool has a free one", () => {
    expect(iconsFor(["aljabar"], [holding(POOL[1])])).toEqual([POOL[2]]);
    expect(iconsFor(["aljabar"], [holding(POOL[0])])).toEqual([POOL[1]]);
  });

  it("repeats an icon as late and as evenly as before once the page holds some of the pool", () => {
    const shown = [holding(POOL[0]), holding(POOL[1])];

    expect(iconsFor(Arr.replicate("aljabar", 7), shown)).toEqual(
      Arr.map([2, 3, 4, 1, 2, 3, 4], (place) => POOL[place])
    );
  });

  it("keeps the first tiles of a list whatever comes after them, the page shown or not", () => {
    const seeds = Arr.take(SEEDS, 6);
    const shown = [holding(POOL[3]), holding(POOL[4])];

    for (const length of [1, 3]) {
      expect(iconsFor(Arr.take(seeds, length), shown)).toEqual(
        Arr.take(iconsFor(seeds, shown), length)
      );
    }
  });

  it("turns each tile as getTileShifts does, the page shown or not", () => {
    const seeds = ["aljabar", "tryout/indonesia/snbt"];
    const rows = Arr.map(seeds, (seed) => [POOL, seed] as const);
    const shown = [{ ...holding(POOL[0]), ...at(ALJABAR) }];

    for (const page of [[], shown]) {
      expect(Arr.map(getTileLooks(rows, page), ({ shift }) => shift)).toEqual(
        getTileShifts(seeds, page)
      );
    }
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

describe("getTileIcon", () => {
  it("gives a tile on its own the icon its seed points at", () => {
    expect(getTileIcon(POOL, "aljabar")).toBe(POOL[1]);
    expect(getTileIcon(POOL, "gerak")).toBe(POOL[3]);
    expect(getTileIcon(ALONE, "aljabar")).toBe(ALONE[0]);
  });
});
