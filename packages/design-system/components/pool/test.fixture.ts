import type { Ball } from "@repo/design-system/components/pool/ball";
import { coverOf } from "@repo/design-system/components/pool/cover";
import { poolStarts } from "@repo/design-system/components/pool/member";
import type { World } from "@repo/design-system/components/pool/physics";
import { createWorld } from "@repo/design-system/components/pool/place";

/** One ball inside the box of the tests, unless the test says otherwise. */
export function ballAt(overrides: Partial<Ball>): Ball {
  return {
    inside: true,
    r: 20,
    tilt: 0,
    vx: 0,
    vy: 0,
    x: 600,
    y: 300,
    ...overrides,
  };
}

/** A pool in a 1200 by 640 box, with these balls and nothing else. */
export function boxWith(balls: readonly Ball[]): World {
  return { ...createWorld(1200, 640, []), balls };
}

/** The pool as it starts in a box of this size: its animals, sized for the box, all above it. */
export function poolWorld(width: number, height: number): World {
  return createWorld(width, height, poolStarts(coverOf(width, height)));
}
