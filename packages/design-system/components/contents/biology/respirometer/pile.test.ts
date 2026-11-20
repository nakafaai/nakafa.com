// @vitest-environment node

import { describe, expect, it } from "@effect/vitest";
import type { Pile } from "@repo/design-system/components/contents/biology/respirometer/pile";
import {
  seedAxis,
  segmentGap,
  settlePile,
} from "@repo/design-system/components/contents/biology/respirometer/pile";
import { Array as Arr } from "effect";

/** A pile of mung beans with their radicles, 6.4 by 3.4 mm, on gauze in a 22.6 mm bore. */
const PILE: Pile = {
  ceiling: 0.055,
  count: 60,
  floor: 0.03,
  length: 0.0064,
  radius: 0.0111,
  salt: 3,
  width: 0.0034,
};

describe("seed pile", () => {
  it("measures the gap between two segments across the tube", () => {
    expect(
      segmentGap(
        [
          [-1, 0],
          [1, 0],
        ],
        [
          [0, -1],
          [0, 1],
        ]
      )
    ).toBe(0);
    expect(
      segmentGap(
        [
          [-1, 0],
          [1, 0],
        ],
        [
          [-1, 2],
          [1, 2],
        ]
      )
    ).toBe(2);
    expect(
      segmentGap(
        [
          [0, 0],
          [1, 0],
        ],
        [
          [2, 0],
          [3, 1],
        ]
      )
    ).toBe(1);
  });

  it("settles every seed inside the tube, on the floor or on the seeds below, under the ceiling", () => {
    const seeds = settlePile(PILE);
    const reach = PILE.length / 2 - PILE.width / 2;
    expect(seeds).toHaveLength(PILE.count);
    expect(
      Arr.every(seeds, (seed) =>
        Arr.every(
          seedAxis(seed, reach),
          ([x, z]) => Math.hypot(x, z) <= PILE.radius - PILE.width / 2 + 1e-12
        )
      )
    ).toBe(true);
    expect(
      Arr.every(
        seeds,
        (seed) =>
          seed.y >= PILE.floor + PILE.width / 2 - 1e-12 &&
          seed.y + PILE.width / 2 <= PILE.ceiling
      )
    ).toBe(true);
  });

  it("never lets two seeds cut into each other", () => {
    const seeds = settlePile(PILE);
    const reach = PILE.length / 2 - PILE.width / 2;
    const closest = Arr.reduce(seeds, Number.POSITIVE_INFINITY, (least, a, i) =>
      Arr.reduce(Arr.drop(seeds, i + 1), least, (nearest, b) =>
        Math.min(
          nearest,
          Math.hypot(
            a.y - b.y,
            segmentGap(seedAxis(a, reach), seedAxis(b, reach))
          )
        )
      )
    );
    expect(closest).toBeGreaterThanOrEqual(PILE.width - 1e-12);
  });

  it("leaves out the seeds a low ceiling has no room for, and scatters each tube's pile its own way", () => {
    expect(
      settlePile({ ...PILE, ceiling: PILE.floor + PILE.width }).length
    ).toBeLessThan(PILE.count);
    expect(settlePile(PILE)).toEqual(settlePile(PILE));
    expect(settlePile({ ...PILE, salt: 7 })).not.toEqual(settlePile(PILE));
  });
});
