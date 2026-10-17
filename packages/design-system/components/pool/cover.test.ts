import { describe, expect, it } from "@effect/vitest";
import {
  ARTWORK_SHARE,
  COVER,
  coverOf,
} from "@repo/design-system/components/pool/cover";
import { poolStarts } from "@repo/design-system/components/pool/member";
import { CHECKED_POOLS } from "@repo/design-system/components/pool/test.fixture";
import { Animal } from "@repo/mascot/animal";
import { Array as Arr, Order } from "effect";

/** How far the share of the members may stray from the cover, for the sizes that are left over. */
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

/** The checked pools, and a 4K screen, the widest that the pool is sized for. */
const POOLS = [...CHECKED_POOLS, { height: 2160, width: poolWidth(3840) }];

describe("the members of the pool", () => {
  for (const pool of POOLS) {
    it(`covers about half of a ${pool.width} by ${pool.height} pool with the animals and Nina's things`, () => {
      const share = coveredShare(pool.width, pool.height);
      expect(Math.abs(share - COVER)).toBeLessThanOrEqual(MARGIN);
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
