import { describe, expect, it } from "@effect/vitest";
import {
  paintNormals,
  paintOpenness,
} from "@repo/design-system/components/three/surface/relief";
import { Array as Arr } from "effect";

/** The side of the small tiles these tests paint. */
const SIZE = 8;

/** A tile whose height is given for each column and row. */
function tile(heightAt: (column: number, row: number) => number) {
  return Float32Array.from({ length: SIZE * SIZE }, (_, pixel) =>
    heightAt(pixel % SIZE, Math.floor(pixel / SIZE))
  );
}

/** The normal a pixel was painted with, as three numbers from -1 to 1. */
function normalAt(normals: Uint8ClampedArray, column: number, row: number) {
  const at = (row * SIZE + column) * 4;
  return Arr.map(
    [0, 1, 2],
    (channel) => (Number(normals[at + channel]) / 255) * 2 - 1
  );
}

describe("paintNormals", () => {
  it("faces a flat tile straight out, opaque in every pixel", () => {
    const normals = paintNormals(
      tile(() => 0.5),
      SIZE,
      0.1
    );

    expect(normals).toHaveLength(SIZE * SIZE * 4);
    for (const pixel of Arr.makeBy(SIZE * SIZE, (index) => index)) {
      expect(normals[pixel * 4]).toBe(128);
      expect(normals[pixel * 4 + 1]).toBe(128);
      expect(normals[pixel * 4 + 2]).toBe(255);
      expect(normals[pixel * 4 + 3]).toBe(255);
    }
  });

  it("leans away from the rise: against a slope across the tile, and against one up it", () => {
    const ramp = (place: number) =>
      0.5 + 0.5 * Math.sin((place / SIZE) * 2 * Math.PI);
    const [acrossX, acrossY] = normalAt(
      paintNormals(tile(ramp), SIZE, 0.2),
      0,
      3
    );
    const [upX, upY] = normalAt(
      paintNormals(
        tile((_column, row) => ramp(row)),
        SIZE,
        0.2
      ),
      3,
      0
    );

    expect(acrossX).toBeLessThan(-0.2);
    expect(acrossY).toBeCloseTo(0, 1);
    expect(upX).toBeCloseTo(0, 1);
    expect(upY).toBeLessThan(-0.2);
  });

  it("leans further the deeper the relief stands", () => {
    const ramp = tile(
      (column) => 0.5 + 0.5 * Math.sin((column / SIZE) * 2 * Math.PI)
    );
    const [shallow] = normalAt(paintNormals(ramp, SIZE, 0.05), 0, 0);
    const [deep] = normalAt(paintNormals(ramp, SIZE, 0.4), 0, 0);

    expect(deep).toBeLessThan(Number(shallow) - 0.2);
  });

  it("reads past each edge from the far side, so the tile lights without a seam", () => {
    const step = tile((column) => (column === SIZE - 1 ? 1 : 0));
    const [atFirst] = normalAt(paintNormals(step, SIZE, 0.2), 0, 2);

    expect(atFirst).toBeGreaterThan(0.2);
  });
});

describe("paintOpenness", () => {
  it("leaves a flat tile fully open to the sky", () => {
    const open = paintOpenness(
      tile(() => 0.3),
      SIZE,
      1,
      4
    );

    expect(Arr.every(Arr.fromIterable(open), (value) => value === 1)).toBe(
      true
    );
  });

  it("shades a pit under its rim and leaves the rim open, more with more strength", () => {
    const pit = tile((column, row) => (column === 4 && row === 4 ? 0 : 1));
    const soft = paintOpenness(pit, SIZE, 1, 0.5);
    const strong = paintOpenness(pit, SIZE, 1, 0.9);

    expect(soft[4 * SIZE + 4]).toBeCloseTo(0.5, 5);
    expect(Number(strong[4 * SIZE + 4])).toBeLessThan(
      Number(soft[4 * SIZE + 4])
    );
    expect(soft[4 * SIZE + 3]).toBe(1);
  });

  it("never shades below black, and looks as far as it is told", () => {
    const pit = tile((column, row) => (column === 4 && row === 4 ? 0 : 1));

    expect(paintOpenness(pit, SIZE, 1, 9)[4 * SIZE + 4]).toBe(0);
    expect(
      paintOpenness(
        tile((column) => (column === 0 ? 1 : 0)),
        SIZE,
        3,
        1
      )[3]
    ).toBeLessThan(1);
  });
});
