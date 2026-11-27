import { describe, expect, it } from "@effect/vitest";
import {
  cellsAt,
  chanceAt,
  fractalAt,
  gradientAt,
  ridgedAt,
  warpedAt,
} from "@repo/design-system/components/three/field/noise";
import { Array as Arr, Record } from "effect";

/** The places of a small grid across the tile, edges left out. */
const PLACES = Arr.makeBy(
  144,
  (index) =>
    [((index % 12) + 0.37) / 12, (Math.floor(index / 12) + 0.61) / 12] as const
);

/** The tile fields, each called with the same counts so one test holds them all to one contract. */
const FIELDS = {
  fractal: (x: number, y: number, seed: number) => fractalAt(x, y, 3, 5, seed),
  ridged: (x: number, y: number, seed: number) => ridgedAt(x, y, 3, 5, seed),
  warped: (x: number, y: number, seed: number) =>
    warpedAt(x, y, 3, 5, seed, 0.3),
};

describe("chanceAt", () => {
  it("answers one number in [0, 1) for a place and seed, unlike its neighbours", () => {
    const row = Arr.makeBy(400, (index) => chanceAt(index - 200, 3, 7));

    expect(row).toEqual(
      Arr.makeBy(400, (index) => chanceAt(index - 200, 3, 7))
    );
    expect(Math.min(...row)).toBeGreaterThanOrEqual(0);
    expect(Math.max(...row)).toBeLessThan(1);
    expect(Arr.dedupe(row)).toHaveLength(400);
    expect(Arr.reduce(row, 0, (sum, value) => sum + value) / 400).toBeCloseTo(
      0.5,
      1
    );
    expect(chanceAt(1, 3, 8)).not.toBe(chanceAt(1, 3, 7));
    expect(chanceAt(1, 4, 7)).not.toBe(chanceAt(1, 3, 7));
  });
});

describe("gradientAt", () => {
  it("is 0.5 at every lattice point and stays between 0 and 1 between them", () => {
    expect(gradientAt(3, 2, 8, 8, 1)).toBe(0.5);
    const values = Arr.map(PLACES, ([x, y]) =>
      gradientAt(x * 8, y * 8, 8, 8, 1)
    );

    expect(Math.min(...values)).toBeGreaterThanOrEqual(0);
    expect(Math.max(...values)).toBeLessThanOrEqual(1);
    expect(Math.max(...values) - Math.min(...values)).toBeGreaterThan(0.5);
  });

  it("repeats after its own count of cells each way, however unequal", () => {
    for (const [x, y] of PLACES) {
      expect(gradientAt(x * 3 + 3, y * 7, 3, 7, 9)).toBeCloseTo(
        gradientAt(x * 3, y * 7, 3, 7, 9),
        10
      );
      expect(gradientAt(x * 3, y * 7 - 7, 3, 7, 9)).toBeCloseTo(
        gradientAt(x * 3, y * 7, 3, 7, 9),
        10
      );
    }
  });
});

describe.each(Record.toEntries(FIELDS))("%sAt", (_name, field) => {
  it("answers the same number between 0 and 1 for the same seed, and another for another", () => {
    const first = Arr.map(PLACES, ([x, y]) => field(x, y, 5));

    expect(first).toEqual(Arr.map(PLACES, ([x, y]) => field(x, y, 5)));
    expect(first).not.toEqual(Arr.map(PLACES, ([x, y]) => field(x, y, 6)));
    expect(Math.min(...first)).toBeGreaterThanOrEqual(0);
    expect(Math.max(...first)).toBeLessThanOrEqual(1);
  });

  it("tiles without a seam: one edge of the tile meets the other", () => {
    for (const along of Arr.makeBy(16, (index) => (index + 0.5) / 16)) {
      expect(field(0, along, 3)).toBeCloseTo(field(1, along, 3), 10);
      expect(field(along, 0, 3)).toBeCloseTo(field(along, 1, 3), 10);
    }
  });
});

describe("fractalAt", () => {
  it("adds finer detail with every layer: the field bends more sharply from place to place", () => {
    const bend = (layers: number) =>
      Arr.reduce(
        PLACES,
        0,
        (sum, [x, y]) =>
          sum +
          Math.abs(
            fractalAt(x + 0.004, y, 2, 2, 7, layers) -
              2 * fractalAt(x, y, 2, 2, 7, layers) +
              fractalAt(x - 0.004, y, 2, 2, 7, layers)
          )
      );

    expect(bend(5)).toBeGreaterThan(bend(1) * 3);
  });
});

describe("ridgedAt", () => {
  it("stands highest where its broadest layer crosses its middle", () => {
    expect(ridgedAt(0, 0, 4, 4, 11, 1)).toBe(1);
  });
});

describe("cellsAt", () => {
  it("measures the nearest point, then the second, and names the cell that owns the place", () => {
    for (const [x, y] of PLACES) {
      const { nearest, owner, second } = cellsAt(x, y, 6, 4, 13);

      expect(nearest).toBeGreaterThanOrEqual(0);
      expect(second).toBeGreaterThanOrEqual(nearest);
      expect(second).toBeLessThan(2);
      expect(owner).toBeGreaterThanOrEqual(0);
      expect(owner).toBeLessThan(1);
    }
  });

  it("gives every place of one cell the same owner, and its neighbours another", () => {
    const owners = Arr.dedupe(
      Arr.map(PLACES, ([x, y]) => cellsAt(x, y, 6, 4, 13).owner)
    );

    expect(owners.length).toBeGreaterThan(12);
    expect(owners.length).toBeLessThanOrEqual(24);
  });

  it("tiles without a seam: one edge of the tile meets the other", () => {
    for (const along of Arr.makeBy(16, (index) => (index + 0.5) / 16)) {
      expect(cellsAt(0, along, 6, 4, 13)).toEqual(cellsAt(1, along, 6, 4, 13));
      expect(cellsAt(along, 0, 6, 4, 13)).toEqual(cellsAt(along, 1, 6, 4, 13));
    }
  });
});
