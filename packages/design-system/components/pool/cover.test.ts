import { describe, expect, it } from "@effect/vitest";
import {
  ANIMAL_RADII,
  type Cover,
  coverOf,
} from "@repo/design-system/components/pool/cover";
import { TAILWIND_BREAKPOINT_PIXELS } from "@repo/design-system/lib/breakpoints";
import { Animal } from "@repo/mascot/animal";
import { Array as Arr, Order } from "effect";

/** The share of the pool that the discs of the animals should cover, with a margin for the sizes that are left over. */
const SHARE = 0.5;
const MARGIN = 0.02;
/** The pool on the narrowest screen: the lg breakpoint, where its four of seven columns start. */
const NARROWEST_POOL_WIDTH = TAILWIND_BREAKPOINT_PIXELS.lg * (4 / 7);

/** The area that the discs of the animals of a cover cover, in square pixels. */
function coveredBy(cover: Cover) {
  return Arr.reduce(
    Arr.makeBy(
      cover.animals,
      (place) => ANIMAL_RADII[place % ANIMAL_RADII.length] * cover.scale
    ),
    0,
    (total, radius) => total + Math.PI * radius * radius
  );
}

/** Boxes of the sizes that the pool takes: the narrowest screen, a laptop, a wide monitor, and a 4K screen. */
const BOXES = [
  { height: 640, width: 585.14 },
  { height: 900, width: 822.86 },
  { height: 640, width: 1200 },
  { height: 1440, width: 1462.86 },
  { height: 2160, width: 2194.29 },
];

describe("the animals of the pool", () => {
  for (const box of BOXES) {
    it(`covers about half of a ${box.width} by ${box.height} pool with the discs of its animals`, () => {
      const cover = coverOf(box.width, box.height);
      const share = coveredBy(cover) / (box.width * box.height);
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
      coverOf(NARROWEST_POOL_WIDTH, 640).animals
    );
  });

  it("never holds more animals than the catalog, so no animal appears twice", () => {
    expect(coverOf(2194.29, 2160).animals).toBe(Animal.literals.length);
    expect(coverOf(10_000, 10_000).animals).toBe(Animal.literals.length);
  });

  it("keeps the animals at their own size while the catalog holds them all", () => {
    expect(coverOf(822.86, 900).scale).toBeCloseTo(1, 2);
  });

  it("grows the animals instead of repeating them once the catalog runs out", () => {
    const cover = coverOf(2194.29, 2160);
    expect(cover.animals).toBe(Animal.literals.length);
    expect(cover.scale).toBeGreaterThan(2);
  });
});
