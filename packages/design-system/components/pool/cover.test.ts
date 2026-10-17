import { describe, expect, it } from "@effect/vitest";
import {
  ARTWORK_SHARE,
  coverOf,
} from "@repo/design-system/components/pool/cover";
import { poolStarts } from "@repo/design-system/components/pool/member";
import { Animal } from "@repo/mascot/animal";
import { Array as Arr, Order } from "effect";

/** The share of the pool that its members should cover, with a margin for the sizes that are left over. */
const SHARE = 0.5;
const MARGIN = 0.02;

/** The width of the pool on a screen of this width: the artwork takes its share of the width. */
function poolWidth(screen: number) {
  return screen * ARTWORK_SHARE;
}

/** The share of a pool of this size that its members cover: the discs of the animals and of Nina's things. */
function coveredShare(width: number, height: number) {
  const starts = poolStarts(coverOf(width, height));
  const area = Arr.reduce(
    starts,
    0,
    (total, start) => total + Math.PI * start.r * start.r
  );
  return area / (width * height);
}

/** Pools of the screens that show them: the narrowest, a laptop, a wide monitor, and a 4K screen. */
const POOLS = [
  { height: 640, width: poolWidth(1024) },
  { height: 900, width: poolWidth(1440) },
  { height: 1440, width: poolWidth(2560) },
  { height: 2160, width: poolWidth(3840) },
];

describe("the members of the pool", () => {
  for (const pool of POOLS) {
    it(`covers about half of a ${pool.width} by ${pool.height} pool with the animals and Nina's things`, () => {
      const share = coveredShare(pool.width, pool.height);
      expect(Math.abs(share - SHARE)).toBeLessThanOrEqual(MARGIN);
    });
  }

  it("holds more animals in a bigger pool", () => {
    const sizes = [300, 585, 800, 1200, 1500, 2200, 4000];
    const counts = Arr.map(sizes, (width) => coverOf(width, 800).animals);
    expect(counts).toEqual(Arr.sort(counts, Order.Number));
  });

  it("holds the floor of animals on a pool smaller than the narrowest screen", () => {
    expect(coverOf(100, 100).animals).toBe(
      coverOf(poolWidth(1024), 640).animals
    );
  });

  it("never holds more animals than the catalog, so no animal appears twice", () => {
    expect(coverOf(poolWidth(3840), 2160).animals).toBe(Animal.literals.length);
    expect(coverOf(10_000, 10_000).animals).toBe(Animal.literals.length);
  });

  it("keeps the animals at their own size while the catalog holds them all", () => {
    expect(coverOf(poolWidth(1440), 900).scale).toBeCloseTo(1, 2);
  });

  it("grows the animals instead of repeating them once the catalog runs out", () => {
    const cover = coverOf(poolWidth(3840), 2160);
    expect(cover.animals).toBe(Animal.literals.length);
    expect(cover.scale).toBeGreaterThan(2);
  });
});
