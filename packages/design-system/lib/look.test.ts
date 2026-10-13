import { describe, expect, it } from "@effect/vitest";
import type { IconSvgElement } from "@hugeicons/react";
import {
  getTileIcon,
  getTileLooks,
  getTileShifts,
  TILE_HUE_GAP,
} from "@repo/design-system/lib/look";
import { getTileGradient, wrap } from "@repo/design-system/lib/tile";
import { Array as Arr, HashMap, HashSet, Predicate, Tuple } from "effect";

/** The two hues of one gradient, as `getTileGradient` paints them. */
const HUES =
  /^linear-gradient\(\d+deg,oklch\(0\.56 0\.12 (\d+)\),oklch\(0\.66 0\.125 (\d+)\)\)$/u;
/** These seeds reach every middle hue. */
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

/** One seed for each middle hue, so that a list can start a tile from any hue of the wheel. */
const SEED_AT = HashMap.fromIterable(
  Arr.map(SEEDS, (seed) => Tuple.make(middleAt(seed, 0), seed))
);

/** The seed of a tile that starts from this middle hue. */
function startingAt(middle: number) {
  return HashMap.getUnsafe(SEED_AT, middle);
}

/**
 * The middles of the five tiles that hide the most hues from a sixth. A tile
 * hides the 71 hues within 35 degrees of its middle, so five hide at most 355
 * of the 360, and they hide that many when they sit 72 degrees apart: one hue
 * stays free between each two of them, exactly 36 degrees from both. A sixth
 * tile can meet nothing narrower, and a shorter list meets more room.
 */
const HIDING_MOST = Arr.makeBy(LONGEST_SURE_LIST - 1, (step) => step * 72);
/** The five tiles that hide the most hues, as seeds. */
const PACKED = Arr.map(HIDING_MOST, startingAt);
/** The hues that stay free between them, which are the only ones a sixth tile can take. */
const FREE = Arr.map(HIDING_MOST, (middle) => middle + TILE_HUE_GAP);
/**
 * Where a sixth tile can start and meet something different. A start inside
 * the hues that one tile hides walks on to the free hue after it, so only the
 * edges of that stretch differ: its first hue (the longest walk, past the end
 * of the wheel for the tile at 0), the hue of the tile itself, its last hue
 * (the shortest walk), and the free hue after it, where a tile stays.
 */
const STARTS = Arr.flatMap(HIDING_MOST, (middle) =>
  Arr.map([1 - TILE_HUE_GAP, 0, TILE_HUE_GAP - 1, TILE_HUE_GAP], (step) =>
    wrap(middle + step)
  )
);

/** The middles of each list that ends with a sixth tile, started from each of `STARTS`, after the five that hide the most hues. */
function sixthTiles(shown?: Parameters<typeof getTileShifts>[1]) {
  return Arr.map(STARTS, (hue) =>
    middlesOf(Arr.append(PACKED, startingAt(hue)), shown)
  );
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

  it(`keeps ${LONGEST_SURE_LIST} tiles at least ${TILE_HUE_GAP} degrees apart where the first five hide the most hues, from whichever hue the last starts`, () => {
    expect(middlesOf(PACKED)).toEqual(HIDING_MOST);

    for (const middles of sixthTiles()) {
      expect(leastDistance(middles)).toBeGreaterThanOrEqual(TILE_HUE_GAP);
    }
  });

  it("keeps the tiles of the two longest real lists the full gap apart", () => {
    // The classes 1 to 8 of the Merdeka curriculum, the longest list of tiles
    // of the corpus, and the seven sections of a UTBK-SNBT set.
    const classes = Arr.makeBy(8, (index) => `class-${index + 1}`);
    const sections = [
      "general-reasoning",
      "general-knowledge-and-understanding",
      "reading-comprehension-and-writing",
      "quantitative-knowledge",
      "literacy-in-indonesian",
      "literacy-in-english",
      "mathematical-reasoning",
    ];

    for (const seeds of [classes, sections]) {
      expect(leastDistance(middlesOf(seeds))).toBe(TILE_HUE_GAP);
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

  it("takes a hue with room in the list over the hues that suit the page best", () => {
    const own = ALJABAR;
    const wall = Arr.map([71, 141, 211, 281, 323], (step) => at(own + step));

    expect(middlesOf(["aljabar", "aljabar"], wall)).toEqual([own, 7]);
  });

  it("keeps the gap inside the list whatever the page shows", () => {
    // A tile of the page on each hue that the five tiles leave free: the hues
    // that suit the page best are then the ones that the list hides.
    const crowded = Arr.map(FREE, at);

    expect(middlesOf(PACKED, crowded)).toEqual(HIDING_MOST);

    for (const middles of sixthTiles(crowded)) {
      expect(leastDistance(middles)).toBeGreaterThanOrEqual(TILE_HUE_GAP);
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

/** One drawing that differs from the others, as an icon of a pool. */
function drawing(path: string): IconSvgElement {
  return [["path", { d: path }]];
}

/** Five drawings that differ from each other, as a pool of icons. */
const POOL = Arr.makeBy(5, (index) => drawing(`M${index} 0`));
/** Three more drawings, as the pool of another subject. */
const OTHER = Arr.makeBy(3, (index) => drawing(`M0 ${index}`));
/** The pool of one icon that a key with its own icon offers. */
const ALONE = Arr.of(drawing("M9 9"));

/** A tile of the page that holds this icon. */
function holding(icon: IconSvgElement) {
  return { icon, seed: "gerak", shift: 0 };
}

/** The icons that a list of tiles takes from one pool, one tile per seed, after the tiles that the page shows. */
function iconsFor(
  seeds: readonly string[],
  shown: readonly ReturnType<typeof holding>[] = []
) {
  return Arr.map(
    getTileLooks(
      Arr.map(seeds, (seed) => Tuple.make(POOL, seed)),
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
    const rows = Arr.map(seeds, (seed) => Tuple.make(POOL, seed));
    const shown = [{ ...holding(POOL[0]), ...at(ALJABAR) }];

    for (const page of [[], shown]) {
      expect(Arr.map(getTileLooks(rows, page), ({ shift }) => shift)).toEqual(
        getTileShifts(seeds, page)
      );
    }
  });

  it("gives each tile back the seed that its list placed it by", () => {
    const seeds = ["aljabar", "gerak", "curriculum/merdeka"];
    const looks = getTileLooks(
      Arr.map(seeds, (seed) => Tuple.make(POOL, seed))
    );

    expect(Arr.map(looks, ({ seed }) => seed)).toEqual(seeds);
  });

  it("gives nothing for a list of nothing", () => {
    expect(getTileLooks([])).toEqual([]);
  });

  it("passes a row that is a string through where it stands", () => {
    const looks = getTileLooks([
      "first.png",
      Tuple.make(POOL, "gerak"),
      "second.png",
    ]);

    expect(looks[0]).toBe("first.png");
    expect(looks[2]).toBe("second.png");
    expect(looks).toHaveLength(3);
  });

  it("places the tiles around a string as if it were not in the list", () => {
    // Each string is also the seed of a tile of the list: if a string took the
    // hue or the icon its seed points at, that tile would have to move.
    const tiles = Arr.map(
      ["aljabar", "tryout/indonesia/snbt", "aljabar"],
      (seed) => Tuple.make(POOL, seed)
    );
    const among = getTileLooks([
      "aljabar",
      ...Arr.take(tiles, 2),
      "tryout/indonesia/snbt",
      ...Arr.drop(tiles, 2),
    ]);

    expect(Arr.filter(among, (row) => !Predicate.isString(row))).toEqual(
      getTileLooks(tiles)
    );
  });
});

describe("getTileIcon", () => {
  it("gives a tile on its own the icon its seed points at", () => {
    expect(getTileIcon(POOL, "aljabar")).toBe(POOL[1]);
    expect(getTileIcon(POOL, "gerak")).toBe(POOL[3]);
    expect(getTileIcon(ALONE, "aljabar")).toBe(ALONE[0]);
  });
});
