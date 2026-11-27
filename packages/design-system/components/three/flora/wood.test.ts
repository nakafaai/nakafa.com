import { describe, expect, it } from "@effect/vitest";
import type { Disc } from "@repo/design-system/components/three/flora/wood";
import {
  discInk,
  paintDisc,
} from "@repo/design-system/components/three/flora/wood";
import { Array as Arr } from "effect";

/** A stem of five years whose every tissue has a red of its own. */
const DISC: Disc = {
  inks: {
    cambium: [10, 200, 10],
    cork: [60, 40, 30],
    early: [220, 190, 140],
    heart: [140, 90, 55],
    late: [150, 105, 60],
    phloem: [200, 150, 115],
    pith: [85, 55, 30],
  },
  rings: 5,
  seed: 3,
  size: 8,
  wood: 0.75,
};

/** The reds met on the way out from the pith along one radius, a thousand steps to the bark. */
function redsAlong(from: number, to: number) {
  return Arr.map(
    Arr.range(Math.round(from * 1000), Math.round(to * 1000)),
    (step) => discInk(DISC, step / 1000, 0.3)[0]
  );
}

describe("discInk", () => {
  it("is pith at the very middle of the stem", () => {
    expect(discInk(DISC, 0, 1)).toEqual(DISC.inks.pith);
  });

  it("lays one ring a year, each ending sharply where winter stopped it", () => {
    const reds = redsAlong(0.05, DISC.wood * 0.9);
    const winters = Arr.filter(
      Arr.zipWith(Arr.drop(reds, 1), reds, (red, before) => red - before),
      (jump) => jump > 10
    );

    expect(winters).toHaveLength(DISC.rings - 1);
  });

  it("darkens the old rings at the heart below the young sapwood", () => {
    const heart = Math.max(...redsAlong(0.05, 0.2));
    const sapwood = Math.max(...redsAlong(0.55, 0.65));

    expect(sapwood).toBeGreaterThan(heart + 20);
  });

  it("rings the wood with the wet line of the cambium", () => {
    const greens = Arr.map(
      Arr.range(0, 1000),
      (step) => discInk(DISC, step / 1000, 0.3)[1]
    );

    expect(Math.max(...greens)).toBe(200);
  });

  it("wraps the stem in inner bark and then cork, darkest at the outside", () => {
    const [inner] = discInk(DISC, 0.8, 0.3);
    const [outer] = discInk(DISC, 1.05, 0.3);

    expect(inner).toBeGreaterThan(120);
    expect(outer).toBeLessThanOrEqual(85);
    expect(outer).toBeGreaterThanOrEqual(60);
  });
});

describe("paintDisc", () => {
  it("paints an opaque square image with the pith at its middle and bark at its corners", () => {
    const pixels = paintDisc(DISC);
    const corner = pixels[0];
    const middle = pixels[(3 * DISC.size + 3) * 4];

    expect(pixels).toHaveLength(DISC.size * DISC.size * 4);
    for (const pixel of Arr.range(0, DISC.size * DISC.size - 1)) {
      expect(pixels[pixel * 4 + 3]).toBe(255);
    }
    expect(Number(corner)).toBeLessThan(Number(middle));
  });
});
