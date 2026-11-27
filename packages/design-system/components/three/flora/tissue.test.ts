import { describe, expect, it } from "@effect/vitest";
import type { Section } from "@repo/design-system/components/three/flora/tissue";
import {
  bendCells,
  CELL_STRIDE,
  domeAt,
  sectionCells,
  sectionWidth,
  ZONES,
} from "@repo/design-system/components/three/flora/tissue";
import { Array as Arr } from "effect";

/** A root tip: a dome with a cap over it, then dividing, growing and grown cells. */
const ROOT: Section = {
  apex: 0.4,
  cap: 0.15,
  division: 0.56,
  elongation: 0.94,
  files: 8,
  length: 1.4,
  radius: 0.26,
  seed: 7,
  short: 0.036,
  skew: 0,
  tall: 0.17,
};

/** The cells of a section as one record each. */
function cellsOf(cells: readonly number[]) {
  return Arr.map(Arr.chunksOf(cells, CELL_STRIDE), (cell) => ({
    angle: Number(cell[2]),
    height: Number(cell[4]),
    nucleus: Number(cell[6]),
    vacuole: Number(cell[5]),
    width: Number(cell[3]),
    x: Number(cell[0]),
    y: Number(cell[1]),
    zone: Number(cell[7]),
  }));
}

/** The mean of some numbers. */
function mean(values: readonly number[]) {
  return Arr.reduce(values, 0, (sum, value) => sum + value) / values.length;
}

describe("domeAt", () => {
  it("rounds the tip from nothing at the middle to the whole dome at the flank", () => {
    expect(domeAt(ROOT, 0)).toBe(0);
    expect(domeAt(ROOT, 1)).toBeCloseTo(ROOT.apex);
    expect(domeAt(ROOT, 1.5)).toBeCloseTo(ROOT.apex);
    expect(domeAt(ROOT, 0.5)).toBeGreaterThan(0);
    expect(domeAt(ROOT, 0.5)).toBeLessThan(ROOT.apex / 2);
  });
});

describe("sectionWidth", () => {
  it("opens from a point at the tip to the full radius behind the dome", () => {
    expect(sectionWidth(ROOT, 0)).toBe(0);
    expect(sectionWidth(ROOT, ROOT.apex / 2)).toBeGreaterThan(ROOT.radius / 2);
    expect(sectionWidth(ROOT, ROOT.apex / 2)).toBeLessThan(ROOT.radius);
    expect(sectionWidth(ROOT, ROOT.apex)).toBe(ROOT.radius);
    expect(sectionWidth(ROOT, ROOT.length)).toBe(ROOT.radius);
  });
});

describe("sectionCells", () => {
  const cells = cellsOf(sectionCells(ROOT));

  it("keeps every cell inside the organ", () => {
    for (const cell of cells) {
      expect(Math.abs(cell.x) + cell.width / 2).toBeLessThanOrEqual(
        ROOT.radius + 1e-9
      );
      expect(cell.y - cell.height / 2).toBeGreaterThanOrEqual(-1e-9);
      expect(cell.y + cell.height / 2).toBeLessThanOrEqual(ROOT.length + 1e-9);
    }
  });

  it("stacks each file from the dome of the tip without a gap", () => {
    const file = Arr.filter(cells, (cell) => cell.x === cells[0]?.x);
    const across = Number(cells[0]?.x) / ROOT.radius;

    expect(Number(file[0]?.y) - Number(file[0]?.height) / 2).toBeCloseTo(
      domeAt(ROOT, across)
    );
    for (const [cell, before] of Arr.zip(Arr.drop(file, 1), file)) {
      expect(cell.y - cell.height / 2).toBeCloseTo(
        before.y + before.height / 2
      );
    }
  });

  it("runs through cap, division, elongation and maturation from the tip back", () => {
    const middle = Arr.filter(cells, (cell) => cell.x > 0 && cell.x < 0.04);
    const zones = Arr.dedupeAdjacent(Arr.map(middle, (cell) => cell.zone));

    expect(zones).toEqual([
      ZONES.cap,
      ZONES.division,
      ZONES.elongation,
      ZONES.mature,
    ]);
  });

  it("makes dividing cells small and dense and grown cells long and full of vacuole", () => {
    const dividing = Arr.filter(cells, (cell) => cell.zone === ZONES.division);
    const grown = Arr.filter(cells, (cell) => cell.zone === ZONES.mature);

    expect(mean(Arr.map(grown, (cell) => cell.height))).toBeGreaterThan(
      3 * mean(Arr.map(dividing, (cell) => cell.height))
    );
    expect(grown[0]?.vacuole).toBeGreaterThan(Number(dividing[0]?.vacuole));
    expect(dividing[0]?.nucleus).toBeGreaterThan(Number(grown[0]?.nucleus));
  });

  it("gives no two neighbouring cells of a file the same height", () => {
    const grown = Arr.filter(
      cells,
      (cell) => cell.zone === ZONES.mature && cell.x === cells[0]?.x
    );

    expect(grown[0]?.height).not.toBe(grown[1]?.height);
  });

  it("lengthens the cells of one flank when the section is skewed", () => {
    const skewed = cellsOf(
      sectionCells({
        ...ROOT,
        apex: 0,
        cap: 0,
        division: 0,
        elongation: 0,
        skew: 0.4,
      })
    );
    const shaded = Arr.filter(skewed, (cell) => cell.x < -0.2);
    const lit = Arr.filter(skewed, (cell) => cell.x > 0.2);

    expect(mean(Arr.map(shaded, (cell) => cell.height))).toBeGreaterThan(
      1.5 * mean(Arr.map(lit, (cell) => cell.height))
    );
    expect(shaded.length).toBeLessThan(lit.length);
  });
});

describe("bendCells", () => {
  const cell = [0.1, 1.5, 0, 0.05, 0.2, 0.8, 0.3, ZONES.mature, 0.5];

  it("leaves a cell where it is on a straight upright axis", () => {
    const [x, y, angle, ...rest] = bendCells(cell, [
      [0, 0, 0],
      [0, 2, 0],
    ]);

    expect(x).toBeCloseTo(0.1);
    expect(y).toBeCloseTo(1.5);
    expect(angle).toBeCloseTo(0);
    expect(rest).toEqual(Arr.drop(cell, 3));
  });

  it("carries a cell around a bend and turns it with the axis", () => {
    const [x, y, angle] = bendCells(cell, [
      [0, 0, 0],
      [0, 1, 0],
      [1, 1, 0],
    ]);

    expect(x).toBeCloseTo(0.5);
    expect(y).toBeCloseTo(0.9);
    expect(angle).toBeCloseTo(-Math.PI / 2);
  });

  it("carries on straight for a cell before the start or past the end of the path", () => {
    const path = [
      [0, 0, 0],
      [0, 1, 0],
    ] as const;
    const before = bendCells([0, -0.2, ...Arr.drop(cell, 2)], path);
    const past = bendCells([0, 3, ...Arr.drop(cell, 2)], path);

    expect(before[1]).toBeCloseTo(-0.2);
    expect(past[1]).toBeCloseTo(3);
  });
});
